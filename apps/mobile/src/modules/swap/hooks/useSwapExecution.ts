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
import {
    useTransactionEncoder,
    useAlgorandClient,
    useNetwork,
    mapToDisplayableTransaction,
    type PeraDisplayableTransaction,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    isAssetFrozen,
    isMultisigAccount,
    useSelectedAccount,
    useSignerFor,
} from '@perawallet/wallet-core-accounts'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    getOpenSubmissionAttempts,
    getOpenSubmissionAttemptsForIntent,
    STALE_OPEN_ATTEMPT_MS,
    submitAndAutoRefresh,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import {
    isQuoteFresh,
    usePrepareTransactionsMutation,
    useUpdateSwapStatusMutation,
    useSwapHandoffStore,
    validateSwapGroupAgainstQuote,
    type PrepareTransactionsResult,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { AssetFrozenError } from '@perawallet/wallet-core-transactions'
import {
    encodeToBase64,
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { useLanguage } from '@hooks/useLanguage'
import { resolveErrorCopy } from '@i18n/resolveErrorCopy'
import {
    buildGroupPlans,
    scatterSigned,
    serializeGroupPlans,
} from './swapGroupPlan'
import {
    isUserRejectionError,
    QuantumSwapBlockedError,
    requestSwapSignatures,
    requestSwapProposal,
    reportSwapFailure,
} from './swapExecutionHelpers'

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
     * `preparing` (checked after the prepare call settles, before anything
     * is handed to the signing pipeline). Once signing has started the
     * execution is no longer cancellable from here.
     */
    cancel: () => void
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
    const { network } = useNetwork()
    const account = useSelectedAccount()
    // The quantum guard must key off the effective SIGNER, not the selected
    // account's own nominal type: a standard/HD or multisig account rekeyed
    // to a quantum auth account still has `type !== 'quantum'` but signs
    // (Falcon) via the resolved auth account. Same pattern as
    // `useTransactionConfirmationScreen`'s `isQuantumFee` check.
    const signer = useSignerFor(account?.address)
    const deviceId = useDeviceID(network)
    const registerHandoff = useSwapHandoffStore(s => s.registerHandoff)
    const { mutateAsync: prepareTransactions } =
        usePrepareTransactionsMutation()
    const { mutateAsync: updateSwapStatus } = useUpdateSwapStatusMutation()
    const cancelRequestedRef = useRef(false)

    const execute = useCallback(
        async (quote: SwapQuote): Promise<SwapExecutionOutcome> => {
            setError(null)
            setTxIds([])
            cancelRequestedRef.current = false

            const quoteIdStr = quote.quoteIdStr
            if (!quoteIdStr) {
                const message = 'Swap quote is missing its id'
                setError({ phase: 'prepare', message })
                setStatus('error')
                return { kind: 'error', phase: 'prepare', message }
            }

            const [isInFrozen, isOutFrozen] = account
                ? await Promise.all([
                      isAssetFrozen({
                          accountAddress: account.address,
                          assetId: quote.assetIn.assetId,
                          network,
                      }),
                      isAssetFrozen({
                          accountAddress: account.address,
                          assetId: quote.assetOut.assetId,
                          network,
                      }),
                  ])
                : [false, false]

            if (isInFrozen || isOutFrozen) {
                const frozenAssetId = isInFrozen
                    ? quote.assetIn.assetId
                    : quote.assetOut.assetId
                const copy = resolveErrorCopy(
                    new AssetFrozenError(frozenAssetId),
                    t,
                    undefined,
                    getMessage,
                )
                setError({ phase: 'prepare', message: copy.body })
                setStatus('error')
                return {
                    kind: 'error',
                    phase: 'prepare',
                    message: copy.body,
                    title: copy.title,
                }
            }

            // A quote that outlived its TTL (e.g. the confirm sat behind an
            // offline gap) must never reach prepare — the rate it shows is
            // no longer the rate that would execute.
            if (!isQuoteFresh(quote)) {
                setStatus('idle')
                return { kind: 'stale-quote' }
            }

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

            // The user backed out while prepare was in flight — nothing has
            // been signed or broadcast, so abandoning here is safe. Without
            // this check a slow prepare would resume into the signing sheet
            // with nobody watching.
            if (cancelRequestedRef.current) {
                setStatus('idle')
                return { kind: 'cancelled' }
            }

            // A rebuild after a possibly-false failure would produce a new
            // txid algod can't dedupe — refuse while an earlier attempt is
            // still open. The sender must match the one the ledger row was
            // recorded with, so when no sender is known the guard is skipped
            // rather than matched against a blank.
            //
            // The swapId intent key alone is not enough: a refused retry
            // goes stale within SWAP_QUOTE_TTL_MS, the form re-quotes, and
            // the backend hands back a NEW swap_id — so the intent lookup
            // would miss the very row it was meant to catch. The sender-wide
            // swap-flow check is what actually closes that path; the intent
            // lookup stays because it also matches rows this device never
            // recorded a flow tag for.
            const swapSender =
                account?.address ?? quote.swapperAddress ?? undefined
            if (swapSender) {
                // Only rows with no decodable validity window are dropped —
                // never merely old ones. Rounds are not wall-clock, so ageing
                // out a row that may still be live would reopen the very
                // window this guard closes.
                const unevaluatableBefore = Date.now() - STALE_OPEN_ATTEMPT_MS
                let blocked: boolean
                try {
                    const [byIntent, bySender] = await Promise.all([
                        prepareResult.swapIdStr
                            ? getOpenSubmissionAttemptsForIntent({
                                  network,
                                  sender: swapSender,
                                  intentKey: {
                                      kind: 'swap',
                                      swapId: prepareResult.swapIdStr,
                                  },
                                  unevaluatableBefore,
                              })
                            : Promise.resolve([]),
                        // Both flows: a shared-account swap records its row
                        // under 'cosign', so a swap-only filter would miss a
                        // re-proposed multisig retry.
                        getOpenSubmissionAttempts({
                            network,
                            sender: swapSender,
                            flows: ['swap', 'cosign'],
                            unevaluatableBefore,
                        }),
                    ])
                    blocked = byIntent.length > 0 || bySender.length > 0
                } catch (error) {
                    // Fail closed. This block sits outside any try, and the
                    // confirmation sheet has no catch — an escaping SQLite
                    // error would hang it on the spinner forever.
                    logger.warn('swap: rebuild guard lookup failed, refusing', {
                        error,
                    })
                    blocked = true
                }
                if (blocked) {
                    setStatus('verifying')
                    return { kind: 'verifying-previous' }
                }
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

            // Fail-closed: the prepared group is backend-built and these flows
            // skip the standard signing review sheet, so verify it only spends
            // what the reviewed quote implies before signing it.
            try {
                const signableDisplayable = unsignedTxs
                    .map(mapToDisplayableTransaction)
                    .filter(
                        (tx): tx is PeraDisplayableTransaction => tx !== null,
                    )
                validateSwapGroupAgainstQuote(signableDisplayable, quote)
            } catch (e) {
                // Raw text goes to the log, never to `message` — that string is
                // rendered as the toast body in useSwapForm.
                logger.warn('[swap] validation failed', { error: `${e}` })
                const message = t('swap.execution.error_body')
                setError({ phase: 'prepare', message })
                setStatus('error')
                void reportSwapFailure(
                    updateSwapStatus,
                    prepareResult.swapIdStr,
                )
                return { kind: 'error', phase: 'prepare', message }
            }

            // Shared-account (multisig) branch. When the sender is a multisig
            // account we can't submit inline: only the proposer's local key(s)
            // are available, so we propose a `sync` multisig sign-request
            // (backend collects sigs but won't broadcast) and register a
            // persisted handoff. The cosign resolver assembles the composite
            // multisig, interleaves the pre-signed slots, and submits to algod
            // once the co-signer approves from their inbox. Skipped when every
            // slot is pre-signed (nothing to co-sign).
            if (
                account &&
                isMultisigAccount(account) &&
                account.multisigDetails &&
                unsignedTxs.length > 0 &&
                prepareResult.swapIdStr
            ) {
                const swapIdStr = prepareResult.swapIdStr
                const { threshold, addresses } = account.multisigDetails
                const multisigAddress = account.address
                try {
                    setStatus('signing')
                    const serializedPlan = serializeGroupPlans(
                        plans,
                        encodeSignedTransactions,
                        encodeToBase64,
                    )
                    await requestSwapProposal(
                        addSignRequest,
                        signer,
                        {
                            name: t('swap.signing.source_name'),
                            description: t('swap.signing.source_description'),
                        },
                        unsignedTxs,
                        groupContext,
                        ({ signRequestId, rawTransactionsBase64 }) => {
                            registerHandoff({
                                swapIdStr,
                                signRequestId,
                                network,
                                multisigAddress,
                                deviceId: deviceId ?? '',
                                msigMetadata: {
                                    version: 1,
                                    threshold,
                                    addresses,
                                },
                                plan: serializedPlan,
                                expectedRawTransactionsBase64:
                                    rawTransactionsBase64,
                                registeredAt: Date.now(),
                            })
                        },
                    )
                    setStatus('pending-cosign')
                    return { kind: 'pending-cosign' }
                } catch (e) {
                    const isRejection = isUserRejectionError(e)
                    if (!isRejection) {
                        logger.warn('[swap] propose failed', {
                            error: `${e}`,
                        })
                    }
                    const message = isRejection
                        ? t('swap.execution.user_rejected')
                        : // Guard rejections carry an i18n key of their own;
                          // everything else gets the generic localized copy
                          // rather than the raw error text (PERA-4795).
                          e instanceof QuantumSwapBlockedError
                          ? t(e.translationKey)
                          : t('swap.execution.error_body')
                    setError({ phase: 'signing', message })
                    setStatus('error')
                    if (isRejection) {
                        return { kind: 'cancelled' }
                    }
                    void reportSwapFailure(updateSwapStatus, swapIdStr)
                    return { kind: 'error', phase: 'signing', message }
                }
            }

            // Phase 2: Sign transactions via the signing pipeline.
            // Skip the pipeline entirely when every txn is already pre-signed
            // — the quantum guard inside `requestSwapSignatures` therefore
            // doesn't run in that shape either, which is correct: there is
            // nothing left for the account to sign, so there's no fee to
            // raise and no signature to invalidate.
            let flatSigned: PeraSignedTransaction[]
            try {
                setStatus('signing')
                flatSigned =
                    unsignedTxs.length > 0
                        ? await requestSwapSignatures(
                              addSignRequest,
                              signer,
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
                const isRejection = isUserRejectionError(e)
                if (!isRejection) {
                    logger.warn('[swap] signing failed', { error: `${e}` })
                }
                const message = isRejection
                    ? t('swap.execution.user_rejected')
                    : // Guard rejections carry an i18n key of their own;
                      // everything else gets the generic localized copy rather
                      // than the raw error text (PERA-4795).
                      e instanceof QuantumSwapBlockedError
                      ? t(e.translationKey)
                      : t('swap.execution.error_body')
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
                        {
                            flow: 'swap',
                            // No swapId means no stable identity — a blank key
                            // would collide unrelated swaps, and the rebuild
                            // guard skips them anyway.
                            intentKey: prepareResult.swapIdStr
                                ? {
                                      kind: 'swap',
                                      swapId: prepareResult.swapIdStr,
                                  }
                                : undefined,
                            sender: account?.address ?? quote.swapperAddress,
                        },
                    )
                    collectedTxIds.push(...ids)
                }
            } catch (e) {
                const copy = resolveErrorCopy(e, t, undefined, getMessage)
                setError({ phase: 'submission', message: copy.body })
                setStatus('error')
                void reportSwapFailure(
                    updateSwapStatus,
                    prepareResult.swapIdStr,
                )
                return {
                    kind: 'error',
                    phase: 'submission',
                    message: copy.body,
                    title: copy.title,
                }
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
            network,
            account,
            signer,
            deviceId,
            registerHandoff,
        ],
    )

    const reset = useCallback(() => {
        setStatus('idle')
        setError(null)
        setTxIds([])
        cancelRequestedRef.current = false
    }, [])

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
