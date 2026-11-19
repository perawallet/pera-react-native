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
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { SubmissionError } from '@perawallet/wallet-core-signing'
import {
    isQuoteFresh,
    pickRefreshedQuote,
    SWAP_QUOTE_EXECUTION_MARGIN_MS,
    SwapAccountUnsupportedError,
    SwapCosignUnsupportedError,
    swapFailureStepOf,
    swapOrderRefusalOf,
    useCreateQuotesMutation,
    useExecuteSwapMutation,
    type ExecuteSwapResult,
    type SwapExecutionFailure,
    type SwapFailureStep,
    type SwapOrderRefusal,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { AssetFrozenError } from '@perawallet/wallet-core-transactions'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    formatNumber,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useNodeErrorMessage } from '@hooks/useNodeErrorMessage'
import { useLanguage } from '@hooks/useLanguage'
import { useTransactionOutcomeHaptics } from '@hooks/useTransactionOutcomeHaptics'
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
    | { kind: 'success'; isPaidOutLater: boolean }
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
          // Names the step that stopped the swap (or the honest
          // unknown-outcome headline); always set by this hook. Optional so
          // callers keep their own fallback title for outcomes they construct.
          title?: string
      }

type UseSwapExecutionResult = {
    /**
     * `prepareDestination` runs before the order exists; false, or a cancel
     * while it runs, abandons the swap with nothing created.
     */
    execute: (
        quote: SwapQuote,
        prepareDestination?: () => Promise<boolean>,
    ) => Promise<SwapExecutionOutcome>
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

type DisplayedFailure = { message: string; title: string }

const FAILED_TITLE_KEY_BY_STEP: Record<SwapFailureStep, I18nKey> = {
    prepare: i18nKey('swap.execution.failed_title.prepare'),
    approval: i18nKey('swap.execution.failed_title.approval'),
    swap: i18nKey('swap.execution.failed_title.swap'),
}

const BODY_KEY_BY_REFUSAL: Record<SwapOrderRefusal, I18nKey> = {
    'insufficient-balance': i18nKey(
        'swap.execution.order_insufficient_balance_body',
    ),
    'provider-unavailable': i18nKey('swap.execution.provider_unavailable_body'),
    'provider-declined': i18nKey('swap.execution.provider_failed_body'),
}

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
    const { getMessage } = useNodeErrorMessage()
    const { handleSubmitError, playFailure } = useTransactionOutcomeHaptics()
    const { mutateAsync: executeSwap, reset: resetMutation } =
        useExecuteSwapMutation()
    const { mutateAsync: createQuotes } = useCreateQuotesMutation()
    const cancelRequestedRef = useRef(false)

    const describeFailure = useCallback(
        (failure: SwapExecutionFailure): DisplayedFailure => {
            const stepTitle = t(
                FAILED_TITLE_KEY_BY_STEP[swapFailureStepOf(failure)],
            )
            const copyOf = (error: unknown) =>
                resolveErrorCopy(error, t, stepTitle, getMessage)
            switch (failure.reason) {
                case 'asset-frozen': {
                    const copy = copyOf(new AssetFrozenError(failure.assetId))
                    return { message: copy.body, title: stepTitle }
                }
                case 'insufficient-native-balance': {
                    const nativeAsset = nativeAssetFor(failure.chainId)
                    const symbol = nativeAsset.unitName ?? ''
                    const { sign, integer, fraction } = formatNumber(
                        baseUnitsToDisplayUnits(
                            failure.shortfall,
                            nativeAsset.decimals,
                        ),
                        nativeAsset.decimals,
                        undefined,
                        0,
                    )
                    return {
                        message: t('swap.execution.insufficient_native_body', {
                            amount: `${sign}${integer}${fraction}`,
                            symbol,
                        }),
                        title: stepTitle,
                    }
                }
                // The order call reached the router, so the refusal code says
                // what to do about it; anything else keeps the generic copy.
                case 'prepare-failed': {
                    const refusal = swapOrderRefusalOf(failure.error)
                    return {
                        message: refusal
                            ? t(BODY_KEY_BY_REFUSAL[refusal])
                            : copyOf(failure.error).body,
                        title: stepTitle,
                    }
                }
                case 'quote-mismatch': {
                    return {
                        message: t('swap.execution.quote_mismatch_body'),
                        title: stepTitle,
                    }
                }
                case 'no-signable-steps':
                case 'unsupported-steps': {
                    return {
                        message: t('swap.execution.unsupported_order_body'),
                        title: stepTitle,
                    }
                }
                case 'signing-failed': {
                    return {
                        message: t('swap.execution.signing_failed_body'),
                        title: stepTitle,
                    }
                }
                // An offline failure surfaces its own copy — never the algod
                // fallback, which would blame the node for a request that
                // never reached it. An unknown outcome keeps its own headline:
                // "failed" would be a lie when the transaction may have landed.
                case 'submission-failed':
                case 'reverted': {
                    const copy = copyOf(failure.error)
                    const isUnknownOutcome =
                        failure.error instanceof SubmissionError &&
                        failure.error.classification === 'unknown-outcome'
                    return {
                        message: copy.body,
                        title: isUnknownOutcome ? copy.title : stepTitle,
                    }
                }
                case 'quantum-blocked': {
                    return {
                        message: t(failure.translationKey),
                        title: stepTitle,
                    }
                }
            }
        },
        [t, getMessage],
    )

    const execute = useCallback(
        async (
            quote: SwapQuote,
            prepareDestination?: () => Promise<boolean>,
        ): Promise<SwapExecutionOutcome> => {
            setError(null)
            setTxIds([])
            cancelRequestedRef.current = false

            if (prepareDestination) {
                setStatus('preparing')
                let isPrepared: boolean
                try {
                    isPrepared = await prepareDestination()
                } catch (error) {
                    // Readying the destination (opt-in, sponsor call) isn't the
                    // swap router, so its errors never read as a provider refusal.
                    const stepTitle = t(FAILED_TITLE_KEY_BY_STEP.prepare)
                    const { body: message } = resolveErrorCopy(
                        error,
                        t,
                        stepTitle,
                        getMessage,
                    )
                    playFailure()
                    setStatus('error')
                    setError({ phase: 'prepare', message })
                    return {
                        kind: 'error',
                        phase: 'prepare',
                        message,
                        title: stepTitle,
                    }
                }
                if (!isPrepared || cancelRequestedRef.current) {
                    setStatus('idle')
                    return { kind: 'cancelled' }
                }
            }

            // The form prices a quote once, and the destination step above can
            // be slow: a quote about to lapse is re-priced rather than bounced.
            let quoteToRun = quote
            if (
                !isQuoteFresh(
                    quote,
                    Date.now() + SWAP_QUOTE_EXECUTION_MARGIN_MS,
                )
            ) {
                setStatus('preparing')
                const offers = await createQuotes(quote.request).catch(
                    (error: unknown): SwapQuote[] => {
                        logger.warn('Swap re-quote at confirm failed', {
                            error,
                        })
                        return []
                    },
                )
                if (cancelRequestedRef.current) {
                    setStatus('idle')
                    return { kind: 'cancelled' }
                }
                const refreshed = pickRefreshedQuote(quote, offers)
                if (!refreshed) {
                    setStatus('idle')
                    return { kind: 'stale-quote' }
                }
                quoteToRun = refreshed
            }

            let result: ExecuteSwapResult
            try {
                result = await executeSwap({
                    quote: quoteToRun,
                    signingSource: {
                        name: t('swap.signing.source_name'),
                        description: t('swap.signing.source_description'),
                    },
                    onProgress: setStatus,
                    isCancelled: () => cancelRequestedRef.current,
                })
            } catch (error) {
                // Refused before anything ran: the account can't swap here.
                // Anything else is unexpected and still escapes.
                if (
                    !(error instanceof SwapAccountUnsupportedError) &&
                    !(error instanceof SwapCosignUnsupportedError)
                ) {
                    throw error
                }
                const copy = resolveErrorCopy(
                    error,
                    t,
                    t(FAILED_TITLE_KEY_BY_STEP.prepare),
                    getMessage,
                )
                playFailure()
                setStatus('error')
                setError({ phase: 'prepare', message: copy.body })
                return {
                    kind: 'error',
                    phase: 'prepare',
                    message: copy.body,
                    title: copy.title,
                }
            }

            setStatus(STATUS_BY_RESULT[result.kind])
            if (result.kind === 'success') {
                setTxIds(result.txIds)
                return {
                    kind: 'success',
                    isPaidOutLater: result.isPaidOutLater ?? false,
                }
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
                if (result.failure.reason === 'submission-failed') {
                    handleSubmitError(result.failure.error)
                } else {
                    playFailure()
                }
                const { message, title } = describeFailure(result.failure)
                setError({ phase, message })
                return { kind: 'error', phase, message, title }
            }
            return { kind: result.kind }
        },
        [
            executeSwap,
            createQuotes,
            t,
            getMessage,
            describeFailure,
            handleSubmitError,
            playFailure,
        ],
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
