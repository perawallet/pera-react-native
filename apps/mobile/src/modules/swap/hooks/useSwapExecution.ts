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

import { useState, useCallback, useRef } from 'react'
import {
    useTransactionEncoder,
    useAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import {
    usePrepareTransactionsMutation,
    useUpdateSwapStatusMutation,
    type TransactionGroup,
    type PrepareTransactionsResult,
} from '@perawallet/wallet-core-swaps'
import {
    concatBytes,
    decodeFromBase64,
    logger,
} from '@perawallet/wallet-core-shared'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'

export type SwapExecutionStatus =
    | 'idle'
    | 'preparing'
    | 'signing'
    | 'submitting'
    | 'updating-status'
    | 'success'
    | 'error'

export type SwapExecutionError = {
    phase: 'prepare' | 'signing' | 'submission' | 'status-update'
    message: string
}

type UseSwapExecutionResult = {
    execute: (quoteIdStr: string) => Promise<boolean>
    status: SwapExecutionStatus
    error: SwapExecutionError | null
    txIds: string[]
    reset: () => void
}

export const useSwapExecution = (): UseSwapExecutionResult => {
    const [status, setStatus] = useState<SwapExecutionStatus>('idle')
    const [error, setError] = useState<SwapExecutionError | null>(null)
    const [txIds, setTxIds] = useState<string[]>([])

    const { signTransactions } = useTransactionSigner()
    const {
        decodeTransaction,
        decodeSignedTransaction,
        encodeSignedTransactions,
    } = useTransactionEncoder()
    const algorandClient = useAlgorandClient()
    const { mutateAsync: prepareTransactions } =
        usePrepareTransactionsMutation()
    const { mutateAsync: updateSwapStatus } = useUpdateSwapStatusMutation()

    const signTransactionsRef = useRef(signTransactions)
    signTransactionsRef.current = signTransactions

    const processTransactionGroup = useCallback(
        async (group: TransactionGroup): Promise<PeraSignedTransaction[]> => {
            const signedTxns: PeraSignedTransaction[] = []

            // Pre-signed transactions from the API (e.g., fee transactions)
            if (group.signedTransactions?.length) {
                for (const b64 of group.signedTransactions) {
                    const bytes = decodeFromBase64(b64)
                    signedTxns.push(decodeSignedTransaction(bytes))
                }
            }

            // Unsigned transactions that need user signing
            if (group.transactions?.length) {
                const unsignedTxns = group.transactions.map(b64 => {
                    const bytes = decodeFromBase64(b64)
                    return decodeTransaction(bytes)
                })

                const allIndices = unsignedTxns.map((_, i) => i)
                const signed = await signTransactionsRef.current(
                    unsignedTxns,
                    allIndices,
                )
                signedTxns.push(...signed)
            }

            return signedTxns
        },
        [decodeTransaction, decodeSignedTransaction],
    )

    const submitTransactionGroup = useCallback(
        async (signedTxns: PeraSignedTransaction[]): Promise<string[]> => {
            const encoded = encodeSignedTransactions(signedTxns)
            const concatenated = concatBytes(...encoded)

            const response =
                (await algorandClient.client.algod.sendRawTransaction(
                    concatenated,
                )) as { txid?: string | string[] }

            const ids: string[] = []
            if (typeof response?.txid === 'string') {
                ids.push(response.txid)
            } else if (Array.isArray(response?.txid)) {
                ids.push(...response.txid)
            }

            // Fallback: extract IDs from signed transactions
            if (ids.length === 0) {
                for (const signedTxn of signedTxns) {
                    if (signedTxn.txn.txId) {
                        ids.push(signedTxn.txn.txId())
                    }
                }
            }

            return ids
        },
        [encodeSignedTransactions, algorandClient],
    )

    const reportFailure = useCallback(
        async (swapIdStr: string | undefined) => {
            if (!swapIdStr) return
            try {
                await updateSwapStatus({
                    swapId: swapIdStr,
                    data: {
                        status: 'failed',
                        reason: 'blockchain_error',
                        swap_version: 'v2',
                    },
                })
            } catch {
                logger.warn('Failed to report swap failure to backend')
            }
        },
        [updateSwapStatus],
    )

    const execute = useCallback(
        async (quoteIdStr: string): Promise<boolean> => {
            setError(null)
            setTxIds([])

            let prepareResult: PrepareTransactionsResult | undefined

            // Phase 1: Prepare transactions
            try {
                setStatus('preparing')
                prepareResult = await prepareTransactions({
                    quote: quoteIdStr,
                })
            } catch (e) {
                const message =
                    e instanceof Error
                        ? e.message
                        : 'Failed to prepare transactions'
                setError({ phase: 'prepare', message })
                setStatus('error')
                return false
            }

            const groups = prepareResult.transactionGroups ?? []
            if (groups.length === 0) {
                setError({
                    phase: 'prepare',
                    message: 'No transaction groups returned',
                })
                setStatus('error')
                return false
            }

            // Phase 2: Sign transactions
            let allSignedGroups: PeraSignedTransaction[][]
            try {
                setStatus('signing')
                allSignedGroups = []
                for (const group of groups) {
                    const signed = await processTransactionGroup(group)
                    allSignedGroups.push(signed)
                }
            } catch (e) {
                const message =
                    e instanceof Error
                        ? e.message
                        : 'Failed to sign transactions'
                setError({ phase: 'signing', message })
                setStatus('error')
                void reportFailure(prepareResult.swapIdStr)
                return false
            }

            // Phase 3: Submit transactions
            const collectedTxIds: string[] = []
            try {
                setStatus('submitting')
                for (const signedGroup of allSignedGroups) {
                    if (signedGroup.length === 0) continue
                    const ids = await submitTransactionGroup(signedGroup)
                    collectedTxIds.push(...ids)
                }
            } catch (e) {
                const message =
                    e instanceof Error
                        ? e.message
                        : 'Failed to submit transactions'
                setError({ phase: 'submission', message })
                setStatus('error')
                void reportFailure(prepareResult.swapIdStr)
                return false
            }

            setTxIds(collectedTxIds)

            // Phase 4: Update swap status
            try {
                setStatus('updating-status')
                if (prepareResult.swapIdStr) {
                    await updateSwapStatus({
                        swapId: prepareResult.swapIdStr,
                        data: {
                            status: 'in_progress',
                            submitted_transaction_ids: collectedTxIds,
                            swap_version: 'v2',
                        },
                    })
                }
            } catch {
                // Non-fatal: transactions are already on chain
                logger.warn(
                    'Failed to update swap status, transactions already submitted',
                )
            }

            setStatus('success')
            return true
        },
        [
            prepareTransactions,
            processTransactionGroup,
            submitTransactionGroup,
            updateSwapStatus,
            reportFailure,
        ],
    )

    const reset = useCallback(() => {
        setStatus('idle')
        setError(null)
        setTxIds([])
    }, [])

    return {
        execute,
        status,
        error,
        txIds,
        reset,
    }
}
