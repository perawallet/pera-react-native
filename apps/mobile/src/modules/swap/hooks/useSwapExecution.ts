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

import { useState, useCallback } from 'react'
import {
    useTransactionEncoder,
    useAlgorandClient,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    submitAndAutoRefresh,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import {
    usePrepareTransactionsMutation,
    useUpdateSwapStatusMutation,
    type PrepareTransactionsResult,
} from '@perawallet/wallet-core-swaps'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { useLanguage } from '@hooks/useLanguage'
import {
    buildGroupPlans,
    scatterSigned,
    SwapUserRejectedError,
} from './swapGroupPlan'
import {
    requestSwapSignatures,
    reportSwapFailure,
} from './swapExecutionHelpers'

export type SwapExecutionStatus =
    | 'idle'
    | 'preparing'
    | 'signing'
    | 'submitting'
    | 'updating-status'
    | 'success'
    | 'error'

export type SwapExecutionErrorPhase =
    | 'prepare'
    | 'signing'
    | 'submission'
    | 'status-update'

export type SwapExecutionError = {
    phase: SwapExecutionErrorPhase
    message: string
}

// Returned inline by `execute` so callers can branch on the outcome
// synchronously after `await`. React state (`status`, `error`) has not
// re-rendered yet at that point, so reading those fields would be stale.
export type SwapExecutionOutcome =
    | { kind: 'success' }
    | { kind: 'cancelled' }
    | { kind: 'error'; phase: SwapExecutionErrorPhase; message: string }

type UseSwapExecutionResult = {
    execute: (quoteIdStr: string) => Promise<SwapExecutionOutcome>
    status: SwapExecutionStatus
    error: Nullable<SwapExecutionError>
    txIds: string[]
    reset: () => void
}

export const useSwapExecution = (): UseSwapExecutionResult => {
    const [status, setStatus] = useState<SwapExecutionStatus>('idle')
    const [error, setError] = useState<Nullable<SwapExecutionError>>(null)
    const [txIds, setTxIds] = useState<string[]>([])

    const { t } = useLanguage()
    const { getMessage } = useAlgodErrorMessage()
    const { addSignRequest } = useSigningRequest()
    const {
        decodeTransaction,
        decodeSignedTransaction,
        encodeSignedTransactions,
    } = useTransactionEncoder()
    const algorandClient = useAlgorandClient()
    const { mutateAsync: prepareTransactions } =
        usePrepareTransactionsMutation()
    const { mutateAsync: updateSwapStatus } = useUpdateSwapStatusMutation()

    const execute = useCallback(
        async (quoteIdStr: string): Promise<SwapExecutionOutcome> => {
            setError(null)
            setTxIds([])

            let prepareResult: Optional<PrepareTransactionsResult>

            // Phase 1: Prepare transactions
            try {
                setStatus('preparing')
                prepareResult = await prepareTransactions({
                    quote: quoteIdStr,
                })
            } catch (e) {
                // Map through getMessage like the submission phase so a
                // backend 4xx surfaces a localized message, not a raw HTTP one.
                const message = getMessage(e).body
                setError({ phase: 'prepare', message })
                setStatus('error')
                return { kind: 'error', phase: 'prepare', message }
            }

            const groups = prepareResult.transactionGroups ?? []
            if (groups.length === 0) {
                const message = 'No transaction groups returned'
                setError({ phase: 'prepare', message })
                setStatus('error')
                return { kind: 'error', phase: 'prepare', message }
            }

            // Decode every group up-front and collect the txns the user
            // needs to sign into a single flat array. `groupContext` is the
            // full ordered list (pre-signed + user-signable, every group
            // concatenated) — required by the signing-machine analyzer's
            // group-integrity check, which recomputes the group hash over
            // the same payload the backend signed.
            const { plans, unsignedTxs, groupContext } = buildGroupPlans(
                groups,
                {
                    decodeTransaction,
                    decodeSignedTransaction,
                },
            )

            // Phase 2: Sign transactions via the signing pipeline.
            // Skip the pipeline entirely when every txn is already pre-signed.
            let flatSigned: PeraSignedTransaction[]
            try {
                setStatus('signing')
                flatSigned =
                    unsignedTxs.length > 0
                        ? await requestSwapSignatures(
                              addSignRequest,
                              {
                                  name: t('swap.signing.source_name'),
                                  description: t(
                                      'swap.signing.source_description',
                                  ),
                              },
                              unsignedTxs,
                              groupContext,
                          )
                        : []
            } catch (e) {
                const isRejection = e instanceof SwapUserRejectedError
                const message = isRejection
                    ? t('swap.execution.user_rejected')
                    : e instanceof Error
                      ? e.message
                      : 'Failed to sign transactions'
                setError({ phase: 'signing', message })
                setStatus('error')
                if (isRejection) {
                    return { kind: 'cancelled' }
                }
                void reportSwapFailure(
                    updateSwapStatus,
                    prepareResult.swapIdStr,
                )
                return { kind: 'error', phase: 'signing', message }
            }

            // Phase 3: Submit transactions
            const allSignedGroups = scatterSigned(plans, flatSigned)
            const collectedTxIds: string[] = []
            try {
                setStatus('submitting')
                for (const signedGroup of allSignedGroups) {
                    if (signedGroup.length === 0) continue
                    const ids = await submitAndAutoRefresh(
                        algorandClient,
                        encodeSignedTransactions,
                        signedGroup,
                    )
                    collectedTxIds.push(...ids)
                }
            } catch (e) {
                const message = getMessage(e).body
                setError({ phase: 'submission', message })
                setStatus('error')
                void reportSwapFailure(
                    updateSwapStatus,
                    prepareResult.swapIdStr,
                )
                return { kind: 'error', phase: 'submission', message }
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
            return { kind: 'success' }
        },
        [
            prepareTransactions,
            decodeTransaction,
            decodeSignedTransaction,
            addSignRequest,
            algorandClient,
            encodeSignedTransactions,
            updateSwapStatus,
            t,
            getMessage,
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
