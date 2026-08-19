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

import { type Decimal } from 'decimal.js'
import { fetchAndPersistAssets } from '@perawallet/wallet-core-assets'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { Arc59SendSummaryResponse } from '@perawallet/wallet-core-asa-inbox'
import {
    useArc59SendTransaction,
    useArc59ClaimTransaction,
} from '@perawallet/wallet-core-asa-inbox'
import {
    displayUnitsToBaseUnits,
    useAlgorandClient,
    useFetchSuggestedMinFee,
    useMinimumFeeConfig,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import {
    resolveMinFeeForSender,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import {
    addToAssetHolding,
    useAccountBalancesInvalidator,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { InvalidSendParamsError } from '../errors'
import { isAlgoAssetId, logger } from '@perawallet/wallet-core-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'

type BaseSendParams = {
    sendMode: 'normal' | 'express' | 'sendArc59' | 'claimArc59' | 'rejectArc59'
    sender?: WalletAccount
    receiver?: string
    asset?: PeraAsset
    amount?: Decimal
    note?: string
}

type SendTransactionParams = BaseSendParams & {
    sendMode: 'normal' | 'express' | 'sendArc59'
    note?: string
    isCloseAccount?: boolean
    arc59Summary?: Arc59SendSummaryResponse
}

type SendClaimParams = BaseSendParams & {
    sendMode: 'claimArc59' | 'rejectArc59'
    shouldClaimAlgo: boolean
    /**
     * Base units. When set on a `claimArc59` send, the flow credits it locally
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

type UseTransactionSendFlowResult = {
    execute: (args: UseTransactionSendFlowParams) => Promise<string>
}

export const useTransactionSendFlow = (): UseTransactionSendFlowResult => {
    const algokit = useAlgorandClient()
    const { submit } = useSignAndSubmitGroup()
    const { network } = useNetwork()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()
    const { buildSendViaInboxTxs } = useArc59SendTransaction()
    const { buildClaimAssetTxs, buildRejectAssetTxs } =
        useArc59ClaimTransaction()
    const accounts = useAllAccounts()
    const { minTxnFee, pqMultiplier, assetMbr } = useMinimumFeeConfig()
    const fetchSuggestedMinFee = useFetchSuggestedMinFee()

    /**
     * Express send has two signers with independent PQ-aware rates: the sender
     * signs the funding/transfer legs, the receiver the opt-in.
     * `resolveMinFeeForSender` resolves the effective signer per address, so a
     * rekeyed party pays its auth account's rate, and owns the congestion guard.
     * `staticFee` only overrides AlgoKit's auto-sizing when the resolved fee
     * exceeds the suggested minimum, so a non-quantum party is unchanged.
     */
    const buildExpressTxs = useCallback(
        async (params: {
            sender: string
            receiver: string
            assetId: bigint
            amount: bigint
        }): Promise<PeraTransaction[]> => {
            const { sender, receiver, assetId, amount } = params

            // Look up receiver's current balance to determine funding needed
            const { amount: currentBalance, minBalance: currentMbr } =
                await algokit.client.algod.accountInformation(receiver).do()

            const suggestedMinFee = await fetchSuggestedMinFee()
            const senderFee = resolveMinFeeForSender({
                senderAddress: sender,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            const receiverFee = resolveMinFeeForSender({
                senderAddress: receiver,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })

            // After opt-in the receiver's MBR increases by assetMbr. The
            // opt-in tx fee is paid from the receiver's balance at the
            // receiver's own (PQ-aware) rate, so reserve exactly that
            // instead of the flat network minimum.
            const mbrAfterOptIn = currentMbr + assetMbr
            const balanceNeeded = mbrAfterOptIn + receiverFee
            const fundingNeeded =
                balanceNeeded > currentBalance
                    ? balanceNeeded - currentBalance
                    : 0n

            const composer = algokit.newGroup()

            // Only add payment if the receiver needs funding
            if (fundingNeeded > 0n) {
                composer.addPayment({
                    sender,
                    receiver,
                    amount: fundingNeeded.microAlgo(),
                    ...(senderFee > suggestedMinFee
                        ? { staticFee: senderFee.microAlgo() }
                        : {}),
                })
            }

            composer
                .addAssetOptIn({
                    sender: receiver,
                    assetId,
                    ...(receiverFee > suggestedMinFee
                        ? { staticFee: receiverFee.microAlgo() }
                        : {}),
                })
                .addAssetTransfer({
                    sender,
                    receiver,
                    amount,
                    assetId,
                    ...(senderFee > suggestedMinFee
                        ? { staticFee: senderFee.microAlgo() }
                        : {}),
                })

            const { transactions } = await composer.build()
            return transactions.map(t => t.txn)
        },
        [
            algokit,
            accounts,
            fetchSuggestedMinFee,
            minTxnFee,
            pqMultiplier,
            assetMbr,
        ],
    )

    /**
     * `resolveMinFeeForSender` resolves the effective signer, so a sender
     * rekeyed to a quantum auth pays the PQ rate even though `params.sender`
     * still names the rekeyed account. `staticFee` only overrides AlgoKit's
     * auto-sizing when the resolved fee exceeds the suggested minimum, so a
     * non-quantum sender is unchanged.
     */
    const buildNormalTxs = useCallback(
        async (params: SendTransactionParams): Promise<PeraTransaction[]> => {
            if (
                !params.asset ||
                params.asset.assetId === '' ||
                !params.sender ||
                !params.receiver ||
                params.amount === undefined
            ) {
                throw new InvalidSendParamsError()
            }

            const assetDecimals = params.asset?.decimals ?? 0
            const amountInBaseUnits = BigInt(
                displayUnitsToBaseUnits(
                    params.amount,
                    assetDecimals,
                ).toString(),
            )

            const suggestedMinFee = await fetchSuggestedMinFee()
            const resolvedFee = resolveMinFeeForSender({
                senderAddress: params.sender.address,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            const feeOverride =
                resolvedFee > suggestedMinFee
                    ? { staticFee: resolvedFee.microAlgo() }
                    : {}

            const composer = algokit.newGroup()
            if (isAlgoAssetId(params.asset.assetId)) {
                composer.addPayment({
                    sender: params.sender.address,
                    receiver: params.receiver,
                    amount: params.isCloseAccount
                        ? BigInt(0).microAlgo()
                        : amountInBaseUnits.microAlgo(),
                    ...(params.isCloseAccount && {
                        closeRemainderTo: params.receiver,
                    }),
                    note: params.note,
                    ...feeOverride,
                })
            } else {
                composer.addAssetTransfer({
                    sender: params.sender.address,
                    receiver: params.receiver,
                    amount: amountInBaseUnits,
                    assetId: BigInt(params.asset.assetId),
                    note: params.note,
                    ...feeOverride,
                })
            }
            const { transactions } = await composer.build()
            return transactions.map(t => t.txn)
        },
        [algokit, accounts, fetchSuggestedMinFee, minTxnFee, pqMultiplier],
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

            const assetDecimals = params.asset?.decimals ?? 0
            const amountInBaseUnits = BigInt(
                displayUnitsToBaseUnits(
                    params.amount,
                    assetDecimals,
                ).toString(),
            )
            const assetId = BigInt(params.asset.assetId)

            switch (params.sendMode) {
                case 'express': {
                    const unsignedTxs = await buildExpressTxs({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId,
                        amount: amountInBaseUnits,
                    })
                    const result = await submit({
                        unsignedTxs,
                        source: SEND_TRANSACTION_SOURCE,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'sendArc59': {
                    if (!params.arc59Summary) {
                        throw new InvalidSendParamsError()
                    }
                    const suggestedMinFee = await fetchSuggestedMinFee()
                    const senderMinFee = resolveMinFeeForSender({
                        senderAddress: params.sender.address,
                        accounts,
                        suggestedMinFee,
                        configMinTxnFee: minTxnFee,
                        pqMultiplier,
                    })
                    const unsignedTxs = await buildSendViaInboxTxs({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId,
                        amount: amountInBaseUnits,
                        summary: params.arc59Summary,
                        senderMinFee,
                    })
                    const result = await submit({
                        unsignedTxs,
                        source: SEND_TRANSACTION_SOURCE,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'normal': {
                    const unsignedTxs = await buildNormalTxs(params)
                    const result = await submit({
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
            buildSendViaInboxTxs,
            buildNormalTxs,
            submit,
            accounts,
            fetchSuggestedMinFee,
            minTxnFee,
            pqMultiplier,
        ],
    )

    const executeArc59 = useCallback(
        async (params: SendClaimParams): Promise<string> => {
            if (!params.asset || !params.sender) {
                throw new InvalidSendParamsError()
            }

            if (params.sendMode === 'claimArc59') {
                const unsignedTxs = await buildClaimAssetTxs({
                    sender: params.sender.address,
                    assetId: BigInt(params.asset.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                    inboxAddress: params.inboxAddress ?? null,
                })
                const result = await submit({
                    unsignedTxs,
                    source: SEND_TRANSACTION_SOURCE,
                })

                // Credit optimistically so the asset list updates without
                // waiting for confirmation. The next sync replaces it with chain
                // truth, so a failed claim self-corrects within a poll tick.
                if (params.amount) {
                    try {
                        await addToAssetHolding({
                            accountAddress: params.sender.address,
                            assetId: String(params.asset.assetId),
                            network,
                            amount: params.amount,
                        })
                        await fetchAndPersistAssets(
                            [String(params.asset.assetId)],
                            network,
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
                const unsignedTxs = await buildRejectAssetTxs({
                    sender: params.sender.address,
                    assetId: BigInt(params.asset.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                    inboxAddress: params.inboxAddress ?? null,
                    assetCreator: params.asset.creator.address,
                })
                const result = await submit({
                    unsignedTxs,
                    source: SEND_TRANSACTION_SOURCE,
                })
                return result.txIds[result.txIds.length - 1]
            }
        },
        [
            buildClaimAssetTxs,
            buildRejectAssetTxs,
            submit,
            network,
            invalidateBalances,
        ],
    )

    const execute = useCallback(
        async ({ params }: UseTransactionSendFlowParams): Promise<string> => {
            if (!params) {
                throw new InvalidSendParamsError()
            }
            if (
                params.sendMode === 'claimArc59' ||
                params.sendMode === 'rejectArc59'
            ) {
                return await executeArc59(params)
            }
            return await executeSend(params as SendTransactionParams)
        },
        [executeArc59, executeSend],
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
