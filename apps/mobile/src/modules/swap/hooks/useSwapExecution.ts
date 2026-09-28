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

import { useState, useCallback, useRef } from 'react'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import {
    useExecuteSwapMutation,
    type ExecuteSwapResult,
    type SwapExecutionFailure,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { AssetFrozenError } from '@perawallet/wallet-core-transactions'
import { formatNumber, type Nullable } from '@perawallet/wallet-core-shared'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { useIsQuantumSwapEnabled } from '@hooks/useIsQuantumSwapEnabled'
import { useLanguage } from '@hooks/useLanguage'
import { resolveErrorCopy } from '@i18n/resolveErrorCopy'

export type SwapExecutionStatus =
    | 'idle'
    | 'preparing'
    | 'signing'
    | 'submitting'
    | 'updating-status'
    | 'success'
    // Shared-account swap: proposed to the backend, waiting for the co-signer.
    // The cosign resolver finishes submission asynchronously.
    | 'pending-cosign'
    // A rebuild was refused while an earlier attempt for the same swap is
    // still being verified.
    | 'verifying'
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
    // Shared-account swap proposed; co-signer must approve before it submits.
    | { kind: 'pending-cosign' }
    // The quote outlived its client TTL (e.g. the app sat offline between
    // quote and confirm) — never executed; the caller re-quotes.
    | { kind: 'stale-quote' }
    // An earlier attempt for this swap is still open — nothing was signed or
    // broadcast; the user should retry once it resolves.
    | { kind: 'verifying-previous' }
    | {
          kind: 'error'
          phase: SwapExecutionErrorPhase
          message: string
          // The classification-aware title resolveErrorCopy computed, for
          // failures specific enough to name themselves (the honest
          // unknown-outcome headline, a frozen holding). Absent for the
          // generic prepare/signing failures, which keep the caller's default.
          title?: string
      }

type UseSwapExecutionResult = {
    execute: (quote: SwapQuote) => Promise<SwapExecutionOutcome>
    /**
     * Abandons an execution that has not committed yet: effective while
     * `preparing` (checked after the balance preflight and after the prepare
     * call settle, before anything is handed to the signing pipeline). Once
     * signing has started the execution is no longer cancellable from here.
     */
    cancel: () => void
    status: SwapExecutionStatus
    error: Nullable<SwapExecutionError>
    txIds: string[]
    reset: () => void
}

type DisplayedFailure = { message: string; title?: string }

// Status is set synchronously with the returned outcome rather than derived
// from the mutation's result, which React Query publishes a macrotask later:
// callers act on the outcome immediately and must not see a stale status.
const STATUS_BY_RESULT: Record<ExecuteSwapResult['kind'], SwapExecutionStatus> =
    {
        success: 'success',
        cancelled: 'idle',
        'stale-quote': 'idle',
        'pending-cosign': 'pending-cosign',
        'verifying-previous': 'verifying',
        'user-rejected': 'error',
        failed: 'error',
    }

export const useSwapExecution = (): UseSwapExecutionResult => {
    const [status, setStatus] = useState<SwapExecutionStatus>('idle')
    const [error, setError] = useState<Nullable<SwapExecutionError>>(null)
    const [txIds, setTxIds] = useState<string[]>([])

    const { t } = useLanguage()
    const { getMessage } = useAlgodErrorMessage()
    const isQuantumSwapEnabled = useIsQuantumSwapEnabled()
    const { mutateAsync: executeSwap, reset: resetMutation } =
        useExecuteSwapMutation()
    const cancelRequestedRef = useRef(false)

    const describeFailure = useCallback(
        (failure: SwapExecutionFailure): DisplayedFailure => {
            switch (failure.reason) {
                case 'missing-quote-id': {
                    return { message: 'Swap quote is missing its id' }
                }
                case 'no-transaction-groups': {
                    return { message: 'No transaction groups returned' }
                }
                case 'asset-frozen': {
                    const copy = resolveErrorCopy(
                        new AssetFrozenError(failure.assetId),
                        t,
                        undefined,
                        getMessage,
                    )
                    return { message: copy.body, title: copy.title }
                }
                case 'insufficient-native-balance': {
                    const { sign, integer, fraction } = formatNumber(
                        microAlgosToAlgos(failure.shortfall),
                        6,
                        undefined,
                        0,
                    )
                    return {
                        message: t('swap.execution.insufficient_algo_body', {
                            amount: `${sign}${integer}${fraction}`,
                        }),
                        title: t('swap.execution.insufficient_algo_title'),
                    }
                }
                // A backend 4xx or an offline failure surfaces its own copy —
                // never the algod fallback, which would blame the node for a
                // request that never reached it.
                case 'prepare-failed':
                case 'submission-failed': {
                    const copy = resolveErrorCopy(
                        failure.error,
                        t,
                        undefined,
                        getMessage,
                    )
                    return { message: copy.body, title: copy.title }
                }
                case 'quote-mismatch':
                case 'signing-failed': {
                    return { message: t('swap.execution.error_body') }
                }
                case 'quantum-blocked': {
                    return { message: t(failure.translationKey) }
                }
            }
        },
        [t, getMessage],
    )

    const execute = useCallback(
        async (quote: SwapQuote): Promise<SwapExecutionOutcome> => {
            setError(null)
            setTxIds([])
            cancelRequestedRef.current = false

            const result = await executeSwap({
                quote,
                isQuantumSwapEnabled,
                signingSource: {
                    name: t('swap.signing.source_name'),
                    description: t('swap.signing.source_description'),
                },
                onProgress: setStatus,
                isCancelled: () => cancelRequestedRef.current,
            })

            setStatus(STATUS_BY_RESULT[result.kind])
            if (result.kind === 'success') {
                setTxIds(result.txIds)
                return { kind: 'success' }
            }
            if (result.kind === 'user-rejected') {
                setError({
                    phase: 'signing',
                    message: t('swap.execution.user_rejected'),
                })
                return { kind: 'cancelled' }
            }
            if (result.kind === 'failed') {
                const { phase } = result.failure
                const { message, title } = describeFailure(result.failure)
                setError({ phase, message })
                return title === undefined
                    ? { kind: 'error', phase, message }
                    : { kind: 'error', phase, message, title }
            }
            return { kind: result.kind }
        },
        [executeSwap, isQuantumSwapEnabled, t, describeFailure],
    )

    const reset = useCallback(() => {
        setStatus('idle')
        setError(null)
        setTxIds([])
        cancelRequestedRef.current = false
        resetMutation()
    }, [resetMutation])

    const cancel = useCallback(() => {
        cancelRequestedRef.current = true
    }, [])

    return {
        execute,
        cancel,
        status,
        error,
        txIds,
        reset,
    }
}
