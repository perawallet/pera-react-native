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

import { useMemo } from 'react'
import {
    useAlgorandClient,
    useTransactionEncoder,
    ASSET_MBR,
} from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { createLocalSource } from '../sources'
import type { DataSource, TransactionSignableData } from '../types'
import type { SourceDependencies } from '../sources'
import {
    useTransactionPipeline,
    type UseTransactionPipelineOptions,
    type UseTransactionPipelineResult,
} from './useTransactionPipeline'

/**
 * Parameters for the unified send source
 */
export interface SendSourceParams {
    /** Send mode */
    mode: 'normal' | 'express'

    /** Sender address */
    sender: string

    /** Receiver address */
    receiver: string

    /** Amount in base units (microAlgos or asset base units) */
    amount: bigint

    /** Asset ID (0 or undefined for ALGO) */
    assetId?: bigint

    /** Optional transaction note */
    note?: string

    /** Whether to close the account (send remaining balance to receiver) */
    isCloseAccount?: boolean
}

/**
 * Hook that provides source dependencies from the AlgoKit client
 */
const useSourceDependencies = (): SourceDependencies => {
    // No signer needed for building unsigned transactions
    const algokit = useAlgorandClient()
    const { encodeTransaction } = useTransactionEncoder()

    return useMemo(
        () => ({
            createPaymentTransaction: async params => {
                return algokit.createTransaction.payment({
                    sender: params.sender,
                    receiver: params.receiver,
                    amount: params.amount.microAlgo(),
                    closeRemainderTo: params.closeRemainderTo,
                    note: params.note,
                })
            },

            createAssetTransferTransaction: async params => {
                return algokit.createTransaction.assetTransfer({
                    sender: params.sender,
                    receiver: params.receiver,
                    amount: params.amount,
                    assetId: params.assetId,
                    note: params.note,
                })
            },

            createAssetOptInTransaction: async params => {
                return algokit.createTransaction.assetOptIn({
                    sender: params.sender,
                    assetId: params.assetId,
                })
            },

            encodeTransaction,

            getAccountInfo: async (address: string) => {
                const info =
                    await algokit.client.algod.accountInformation(address)
                return {
                    amount: info.amount,
                    minBalance: info.minBalance,
                }
            },

            getSuggestedParams: async () => {
                const params = await algokit.getSuggestedParams()
                return { minFee: params.minFee }
            },

            assetMbr: ASSET_MBR,
        }),
        [algokit, encodeTransaction],
    )
}

/**
 * Create a unified send source that handles both normal and express sends
 */
const createUnifiedSendSource = (
    deps: SourceDependencies,
): DataSource<SendSourceParams> => {
    const {
        createPaymentTransaction,
        createAssetTransferTransaction,
        createAssetOptInTransaction,
        encodeTransaction,
        getAccountInfo,
        getSuggestedParams,
        assetMbr,
    } = deps

    return createLocalSource<SendSourceParams>(
        async (params: SendSourceParams): Promise<TransactionSignableData> => {
            const {
                mode,
                sender,
                receiver,
                amount,
                assetId,
                note,
                isCloseAccount,
            } = params

            // Normal send mode
            if (mode === 'normal') {
                const isAlgoPayment = !assetId || assetId === 0n

                let transaction: PeraTransaction

                if (isAlgoPayment) {
                    transaction = await createPaymentTransaction({
                        sender,
                        receiver,
                        amount: isCloseAccount ? 0n : amount,
                        closeRemainderTo: isCloseAccount ? receiver : undefined,
                        note,
                    })
                } else {
                    transaction = await createAssetTransferTransaction({
                        sender,
                        receiver,
                        amount,
                        assetId,
                        note,
                    })
                }

                const encoded = encodeTransaction(transaction)
                const base64 = encodeToBase64(encoded)

                return {
                    type: 'transactions',
                    transactions: [transaction],
                    rawTransactionsBase64: [base64],
                    indicesToSign: [0],
                }
            }

            // Express send mode
            // Look up receiver's current balance to determine funding needed
            const { amount: currentBalance, minBalance: currentMbr } =
                await getAccountInfo(receiver)

            // Get suggested params for fee calculation
            const suggestedParams = await getSuggestedParams()

            // After opt-in the receiver's MBR increases by ASSET_MBR
            // The opt-in tx fee is also paid from the receiver's balance
            const mbrAfterOptIn = currentMbr + assetMbr
            const balanceNeeded = mbrAfterOptIn + suggestedParams.minFee
            const fundingNeeded =
                balanceNeeded > currentBalance
                    ? balanceNeeded - currentBalance
                    : 0n

            const transactions: PeraTransaction[] = []
            // Track which transactions the sender signs
            // The opt-in is signed by the receiver, not the sender
            const senderIndicesToSign: number[] = []

            // Add funding payment if needed
            if (fundingNeeded > 0n) {
                const fundingTx = await createPaymentTransaction({
                    sender,
                    receiver,
                    amount: fundingNeeded,
                })
                senderIndicesToSign.push(transactions.length)
                transactions.push(fundingTx)
            }

            // Add opt-in transaction (signed by receiver)
            const optInTx = await createAssetOptInTransaction({
                sender: receiver,
                assetId: assetId!,
            })
            // Note: opt-in is NOT in senderIndicesToSign - it's signed by receiver
            transactions.push(optInTx)

            // Add transfer transaction
            const transferTx = await createAssetTransferTransaction({
                sender,
                receiver,
                amount,
                assetId: assetId!,
            })
            senderIndicesToSign.push(transactions.length)
            transactions.push(transferTx)

            // Encode all transactions
            const rawTransactionsBase64 = transactions.map(tx =>
                encodeToBase64(encodeTransaction(tx)),
            )

            return {
                type: 'transactions',
                transactions,
                rawTransactionsBase64,
                indicesToSign: senderIndicesToSign,
            }
        },
    )
}

/**
 * Options for the send pipeline hook
 */
export type UseSendPipelineOptions = Omit<
    UseTransactionPipelineOptions<SendSourceParams>,
    'source'
>

/**
 * Hook for executing send transactions through the pipeline.
 * Handles both normal sends and express sends (opt-in + transfer).
 *
 * @example
 * const { execute, isExecuting } = useSendPipeline()
 *
 * // Normal ALGO send
 * await execute({
 *   mode: 'normal',
 *   sender: 'ABC...',
 *   receiver: 'XYZ...',
 *   amount: 1000000n,  // 1 ALGO
 * }, account)
 *
 * // Express ASA send (funds receiver, opts in, transfers)
 * await execute({
 *   mode: 'express',
 *   sender: 'ABC...',
 *   receiver: 'XYZ...',
 *   amount: 100n,
 *   assetId: 123456n,
 * }, account)
 */
export const useSendPipeline = (
    options?: UseSendPipelineOptions,
): UseTransactionPipelineResult<SendSourceParams> => {
    const deps = useSourceDependencies()
    const source = useMemo(() => createUnifiedSendSource(deps), [deps])

    return useTransactionPipeline({
        source,
        ...options,
    })
}
