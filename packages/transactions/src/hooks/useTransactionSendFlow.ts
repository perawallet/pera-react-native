/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback } from 'react'

import type { Decimal } from 'decimal.js'
import type {
    ChainScope,
    FeePreset,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    fetchAndPersistAssets,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    resolveMinFeeForSender,
    useFeeConfig,
    useFetchSuggestedMinFee,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import {
    addressOn,
    addToAssetHolding,
    fetchOnChainAccountState,
    getHoldingRestriction,
    useAccountBalancesInvalidator,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    displayUnitsToBaseUnits,
    displayUnitsToBaseUnitsBigInt,
    logger,
    type Nullable,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import {
    sendFlowChainAdapters,
    sendFlowFeatureFor,
    type AssetInboxQuote,
} from '../chain-adapter'
import { holdingReserveOf, transferChainAdapters } from '../transfer-adapter'
import { AssetFrozenError, InvalidSendParamsError } from '../errors'

type BaseSendParams = {
    sendMode:
        | 'normal'
        | 'express'
        | 'sendAssetInbox'
        | 'claimAssetInbox'
        | 'rejectAssetInbox'
    sender?: WalletAccount
    receiver?: string
    asset?: PeraAsset
    amount?: Decimal
    note?: string
}

type SendTransactionParams = BaseSendParams & {
    sendMode: 'normal' | 'express' | 'sendAssetInbox'
    note?: string
    isCloseAccount?: boolean
    /** The speed a gas-priced chain builds at; a flat-fee chain ignores it. */
    feePreset?: FeePreset
    /** Base units of the native asset: the most the sender confirmed paying; a flat-fee chain ignores it. */
    maxFee?: Decimal
    /** The inbox quote the send was confirmed against; the chain adapter validates it. */
    assetInboxQuote?: AssetInboxQuote
}

type SendClaimParams = BaseSendParams & {
    sendMode: 'claimAssetInbox' | 'rejectAssetInbox'
    shouldClaimAlgo: boolean
    /**
     * Base units. When set on a `claimAssetInbox` send, the flow credits it locally
     * right after submission. Omit to rely on the post-confirmation refresh.
     */
    amount?: Decimal
    /**
     * When present, the claim/reject group uses explicit resource references
     * instead of a live simulate.
     */
    inboxAddress?: Nullable<string>
}

type SendParams = SendTransactionParams | SendClaimParams

type UseTransactionSendFlowParams = {
    params: Nullable<SendParams>
}

/**
 * Exported so the completion-sheet driver can tell send-funds apart from the
 * other `sourceType: 'local'` flows and show the processing sheet only for it.
 */
export const SEND_TRANSACTION_SOURCE = {
    name: 'send-transaction',
    description: 'Send transaction',
}

const senderAddressOn = (sender: WalletAccount, scope: ChainScope): string => {
    const address = addressOn(sender, scope)
    if (!address) throw new InvalidSendParamsError()
    return address
}

type UseTransactionSendFlowResult = {
    execute: (args: UseTransactionSendFlowParams) => Promise<string>
}

export const useTransactionSendFlow = (
    scope: ChainScope,
): UseTransactionSendFlowResult => {
    const { submit } = useSignAndSubmitGroup()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()
    const accounts = useAllAccounts()
    const { minTxnFee, pqMultiplier } = useFeeConfig(scope.chainId)
    const fetchSuggestedMinFee = useFetchSuggestedMinFee(scope.chainId)

    /**
     * Express send has two signers with independent PQ-aware rates: the sender
     * signs the funding/transfer legs, the receiver the opt-in.
     * `resolveMinFeeForSender` resolves the effective signer per address, so a
     * rekeyed party pays its auth account's rate, and owns the congestion guard.
     * A fee is passed on only when the resolved fee exceeds the suggested
     * minimum, so a non-quantum party is unchanged.
     */
    const buildExpressTxs = useCallback(
        async (params: {
            sender: string
            receiver: string
            assetId: bigint
            amount: bigint
        }): Promise<UnsignedTransaction[]> => {
            const { sender, receiver, assetId, amount } = params

            // Look up receiver's current balance to determine funding needed
            const receiverState = await fetchOnChainAccountState(
                receiver,
                scope,
            )
            const currentBalance = toBigInt(
                receiverState.nativeBalanceBaseUnits,
            )
            const currentReserve = toBigInt(receiverState.reserveBalance)

            const suggestedMinFee = await fetchSuggestedMinFee()
            const senderFee = resolveMinFeeForSender(scope.chainId, {
                senderAddress: sender,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            const receiverFee = resolveMinFeeForSender(scope.chainId, {
                senderAddress: receiver,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })

            // Opting in raises the receiver's reserve by one holding. The
            // opt-in tx fee is paid from the receiver's balance at the
            // receiver's own (PQ-aware) rate, so reserve exactly that
            // instead of the flat network minimum.
            const reserveAfterOptIn =
                currentReserve + toBigInt(holdingReserveOf(scope))
            const balanceNeeded = reserveAfterOptIn + receiverFee
            const funding =
                balanceNeeded > currentBalance
                    ? balanceNeeded - currentBalance
                    : 0n

            return sendFlowFeatureFor(scope, 'express').buildTxs({
                scope,
                sender,
                receiver,
                assetId,
                amount,
                funding,
                senderFee: senderFee > suggestedMinFee ? senderFee : undefined,
                receiverFee:
                    receiverFee > suggestedMinFee ? receiverFee : undefined,
            })
        },
        [accounts, fetchSuggestedMinFee, minTxnFee, pqMultiplier, scope],
    )

    /**
     * `resolveMinFeeForSender` resolves the effective signer, so a sender
     * rekeyed to a quantum auth pays the PQ rate even though `params.sender`
     * still names the rekeyed account. A fee is passed on only when the resolved
     * fee exceeds the suggested minimum, so a non-quantum sender is unchanged.
     */
    const buildNormalTxs = useCallback(
        async (
            params: SendTransactionParams,
        ): Promise<UnsignedTransaction[]> => {
            if (
                !params.asset ||
                params.asset.assetId === '' ||
                !params.sender ||
                !params.receiver ||
                params.amount === undefined
            ) {
                throw new InvalidSendParamsError()
            }

            const amountInBaseUnits = displayUnitsToBaseUnits(
                params.amount,
                params.asset.decimals ?? 0,
            )
            const senderAddress = senderAddressOn(params.sender, scope)

            // A chain with no send-flow adapter has no close-out or per-signer
            // fee, so its transfer adapter builds and prices the whole send.
            if (!sendFlowChainAdapters.has(scope.chainId)) {
                return transferChainAdapters.get(scope.chainId).build(
                    {
                        kind: 'transfer',
                        from: senderAddress,
                        to: params.receiver,
                        assetRef: {
                            chainId: scope.chainId,
                            assetId: params.asset.assetId,
                        },
                        amount: amountInBaseUnits,
                        note: params.note,
                    },
                    {
                        scope,
                        feePreset: params.feePreset,
                        maxFee: params.maxFee,
                    },
                )
            }

            const suggestedMinFee = await fetchSuggestedMinFee()
            const resolvedFee = resolveMinFeeForSender(scope.chainId, {
                senderAddress,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            return sendFlowChainAdapters.get(scope.chainId).buildTransferTxs({
                scope,
                sender: senderAddress,
                receiver: params.receiver,
                assetId: params.asset.assetId,
                amount: toBigInt(amountInBaseUnits),
                note: params.note,
                isCloseAccount: params.isCloseAccount,
                fee: resolvedFee > suggestedMinFee ? resolvedFee : undefined,
            })
        },
        [accounts, fetchSuggestedMinFee, minTxnFee, pqMultiplier, scope],
    )

    const executeSend = useCallback(
        async (params: SendTransactionParams): Promise<string> => {
            if (
                !params.asset ||
                params.asset.assetId === '' ||
                !params.sender ||
                !params.receiver ||
                params.amount === undefined
            ) {
                throw new InvalidSendParamsError()
            }

            const senderAddress = senderAddressOn(params.sender, scope)

            // Read at submit time rather than taking the caller's word: a
            // deeplink, a stale screen or a freeze that landed mid-flow would
            // all miss a flag passed in from the UI.
            const restriction = await getHoldingRestriction({
                accountAddress: senderAddress,
                assetId: params.asset.assetId,
                scope,
            })

            if (restriction !== null) {
                throw new AssetFrozenError(params.asset.assetId)
            }

            const assetDecimals = params.asset.decimals ?? 0

            switch (params.sendMode) {
                case 'express': {
                    const unsignedTxs = await buildExpressTxs({
                        sender: senderAddress,
                        receiver: params.receiver,
                        assetId: BigInt(params.asset.assetId),
                        amount: displayUnitsToBaseUnitsBigInt(
                            params.amount,
                            assetDecimals,
                        ),
                    })
                    const result = await submit({
                        scope,
                        unsignedTxs,
                        source: SEND_TRANSACTION_SOURCE,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'sendAssetInbox': {
                    if (!params.assetInboxQuote) {
                        throw new InvalidSendParamsError()
                    }
                    const assetInbox = sendFlowFeatureFor(scope, 'assetInbox')
                    const suggestedMinFee = await fetchSuggestedMinFee()
                    const senderMinFee = resolveMinFeeForSender(scope.chainId, {
                        senderAddress: senderAddress,
                        accounts,
                        suggestedMinFee,
                        configMinTxnFee: minTxnFee,
                        pqMultiplier,
                    })
                    const unsignedTxs = await assetInbox.buildSendTxs({
                        scope: scope,
                        sender: senderAddress,
                        receiver: params.receiver,
                        assetId: BigInt(params.asset.assetId),
                        amount: displayUnitsToBaseUnitsBigInt(
                            params.amount,
                            assetDecimals,
                        ),
                        quote: params.assetInboxQuote,
                        senderMinFee,
                    })
                    const result = await submit({
                        scope,
                        unsignedTxs,
                        source: SEND_TRANSACTION_SOURCE,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'normal': {
                    const unsignedTxs = await buildNormalTxs(params)
                    const result = await submit({
                        scope,
                        unsignedTxs,
                        source: SEND_TRANSACTION_SOURCE,
                    })
                    return result.txIds[0]
                }
                default: {
                    params.sendMode satisfies never
                    throw new InvalidSendParamsError()
                }
            }
        },
        [
            buildExpressTxs,
            buildNormalTxs,
            submit,
            accounts,
            fetchSuggestedMinFee,
            minTxnFee,
            pqMultiplier,
            scope,
        ],
    )

    const executeAssetInboxResolution = useCallback(
        async (params: SendClaimParams): Promise<string> => {
            if (!params.asset || !params.sender) {
                throw new InvalidSendParamsError()
            }
            const senderAddress = senderAddressOn(params.sender, scope)

            const assetInbox = sendFlowFeatureFor(scope, 'assetInbox')
            const suggestedMinFee = await fetchSuggestedMinFee()
            const senderMinFee = resolveMinFeeForSender(scope.chainId, {
                senderAddress: senderAddress,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })

            if (params.sendMode === 'claimAssetInbox') {
                const unsignedTxs = await assetInbox.buildClaimTxs({
                    scope: scope,
                    sender: senderAddress,
                    assetId: BigInt(params.asset.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                    inboxAddress: params.inboxAddress ?? null,
                    senderMinFee,
                })
                const result = await submit({
                    scope,
                    unsignedTxs,
                    source: SEND_TRANSACTION_SOURCE,
                })

                // Credit optimistically so the asset list updates without
                // waiting for confirmation. The next sync replaces it with chain
                // truth, so a failed claim self-corrects within a poll tick.
                if (params.amount) {
                    try {
                        await addToAssetHolding({
                            accountAddress: senderAddress,
                            assetId: String(params.asset.assetId),
                            scope: scope,
                            amount: params.amount,
                        })
                        await fetchAndPersistAssets(
                            [String(params.asset.assetId)],
                            scope,
                        )
                    } catch (error) {
                        // Cosmetic-only failure — the post-confirmation
                        // refresh still updates the balances.
                        logger.warn('Optimistic claim credit failed', {
                            error,
                        })
                    }
                    invalidateBalances()
                }

                return result.txIds[result.txIds.length - 1]
            } else {
                const unsignedTxs = await assetInbox.buildRejectTxs({
                    scope: scope,
                    sender: senderAddress,
                    assetId: BigInt(params.asset.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                    inboxAddress: params.inboxAddress ?? null,
                    assetCreator: params.asset.creator.address,
                    senderMinFee,
                })
                const result = await submit({
                    scope,
                    unsignedTxs,
                    source: SEND_TRANSACTION_SOURCE,
                })
                return result.txIds[result.txIds.length - 1]
            }
        },
        [
            submit,
            scope,
            invalidateBalances,
            accounts,
            fetchSuggestedMinFee,
            minTxnFee,
            pqMultiplier,
        ],
    )

    const execute = useCallback(
        async ({ params }: UseTransactionSendFlowParams): Promise<string> => {
            if (!params) {
                throw new InvalidSendParamsError()
            }
            if (
                params.sendMode === 'claimAssetInbox' ||
                params.sendMode === 'rejectAssetInbox'
            ) {
                return await executeAssetInboxResolution(params)
            }
            return await executeSend(params as SendTransactionParams)
        },
        [executeAssetInboxResolution, executeSend],
    )

    return { execute }
}

export { InvalidSendParamsError } from '../errors'

export type {
    SendTransactionParams,
    SendClaimParams,
    UseTransactionSendFlowParams,
    UseTransactionSendFlowResult,
}
