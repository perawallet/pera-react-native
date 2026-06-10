/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    ALGO_ASSET_ID,
    fetchAndPersistAssets,
} from '@perawallet/wallet-core-assets'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { Arc59SendSummaryResponse } from '@perawallet/wallet-core-asa-inbox'
import {
    useArc59SendTransaction,
    useArc59ClaimTransaction,
} from '@perawallet/wallet-core-asa-inbox'
import {
    ASSET_MBR,
    displayUnitsToBaseUnits,
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { useSignAndSubmitGroup } from '@perawallet/wallet-core-signing'
import {
    addToAssetHolding,
    useAccountBalancesInvalidator,
} from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { InvalidSendParamsError } from '../errors'
import { logger } from '@perawallet/wallet-core-shared'
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
     * Claimed amount in base units. When provided on a `claimArc59` send, the
     * flow optimistically credits it to the sender's local holdings right
     * after submission. Callers that don't know the amount can omit it and
     * rely on the post-confirmation refresh instead.
     */
    amount?: Decimal
}

type SendParams = SendTransactionParams | SendClaimParams

type UseTransactionSendFlowParams = {
    params: Nullable<SendParams>
}

/**
 * Source metadata for the in-app Send-funds flow. Exported so the signing
 * completion-sheet driver can recognize send-funds among the other
 * `sourceType: 'local'` internal flows (swap, opt-in/out) and surface the
 * "transaction processing" sheet only for it.
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
                await algokit.client.algod.accountInformation(receiver)

            // After opt-in the receiver's MBR increases by ASSET_MBR.
            // The opt-in tx fee is also paid from the receiver's balance.
            const suggestedParams = await algokit.getSuggestedParams()
            const mbrAfterOptIn = currentMbr + ASSET_MBR
            const balanceNeeded = mbrAfterOptIn + suggestedParams.minFee
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
                })
            }

            composer
                .addAssetOptIn({ sender: receiver, assetId })
                .addAssetTransfer({ sender, receiver, amount, assetId })

            const { transactions } = await composer.build()
            return transactions.map(t => t.txn)
        },
        [algokit],
    )

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

            const composer = algokit.newGroup()
            if (params.asset.assetId === ALGO_ASSET_ID) {
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
                })
            } else {
                composer.addAssetTransfer({
                    sender: params.sender.address,
                    receiver: params.receiver,
                    amount: amountInBaseUnits,
                    assetId: BigInt(params.asset.assetId),
                    note: params.note,
                })
            }
            const { transactions } = await composer.build()
            return transactions.map(t => t.txn)
        },
        [algokit],
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
                    const unsignedTxs = await buildSendViaInboxTxs({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId,
                        amount: amountInBaseUnits,
                        summary: params.arc59Summary,
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
        [buildExpressTxs, buildSendViaInboxTxs, buildNormalTxs, submit],
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
                })
                const result = await submit({
                    unsignedTxs,
                    source: SEND_TRANSACTION_SOURCE,
                })

                // Optimistically credit the claimed amount (and make sure the
                // asset's metadata is persisted) so the asset list shows the
                // new balance immediately instead of waiting for confirmation
                // + refresh. The next account sync replaces the credit with
                // chain truth, so a failed claim self-corrects within a poll
                // tick. Mirrors useAssetOptInMutation's optimistic holding
                // insert.
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
