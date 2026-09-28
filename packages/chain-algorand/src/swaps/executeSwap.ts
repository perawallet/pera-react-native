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

import { Decimal } from 'decimal.js'
import {
    mapToDisplayableTransaction,
    type PeraDisplayableTransaction,
    type PeraSignedTransaction,
    type PeraTransaction,
    type getAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import {
    isAssetFrozen,
    isMultisigAccount,
} from '@perawallet/wallet-core-accounts'
import {
    getOpenSubmissionAttempts,
    STALE_OPEN_ATTEMPT_MS,
    submitAndAutoRefresh,
} from '@perawallet/wallet-core-signing'
import {
    ALGO_ASSET_ID,
    encodeToBase64,
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    isQuoteFresh,
    type ExecuteSwapParams,
    type ExecuteSwapResult,
    type PrepareTransactionsResult,
    type SwapExecutionContext,
    type SwapExecutionFailure,
} from '@perawallet/wallet-core-swaps'
import { computeSwapAlgoShortfall } from './computeSwapAlgoShortfall'
import { validateSwapGroupAgainstQuote } from './validateSwapGroupAgainstQuote'
import {
    buildGroupPlans,
    scatterSigned,
    serializeGroupPlans,
} from './swapGroupPlan'
import {
    isUserRejectionError,
    QuantumSwapBlockedError,
    reportSwapFailure,
    requestSwapProposal,
    requestSwapSignatures,
} from './swapExecutionHelpers'

export type AlgorandSwapExecutionContext = Omit<
    SwapExecutionContext,
    'assetOptInMinBalance'
> & {
    algorandClient: ReturnType<typeof getAlgorandClient>
    /** Asset opt-in minimum balance, in microAlgos. */
    assetMbr: bigint
    decodeTransaction: (bytes: Uint8Array) => PeraTransaction
    decodeSignedTransaction: (bytes: Uint8Array) => PeraSignedTransaction
    encodeSignedTransactions: (txns: PeraSignedTransaction[]) => Uint8Array[]
}

const failed = (failure: SwapExecutionFailure): ExecuteSwapResult => ({
    kind: 'failed',
    failure,
})

const signingFailure = (error: unknown): ExecuteSwapResult =>
    // Guard rejections carry an i18n key of their own; everything else gets
    // generic copy rather than the raw error text.
    error instanceof QuantumSwapBlockedError
        ? failed({
              phase: 'signing',
              reason: 'quantum-blocked',
              translationKey: error.translationKey,
          })
        : failed({ phase: 'signing', reason: 'signing-failed' })

/**
 * Runs a quote through preflight → prepare → sign → submit → status update.
 * Never throws for an expected failure — every user-visible outcome is a
 * result — but an unexpected decode error still escapes.
 */
export const executeAlgorandSwap = async (
    {
        quote,
        account,
        signer,
        isQuantumSwapEnabled,
        signingSource,
        onProgress,
        isCancelled,
    }: ExecuteSwapParams,
    {
        network,
        algorandClient,
        assetMbr,
        deviceId,
        addSignRequest,
        decodeTransaction,
        decodeSignedTransaction,
        encodeSignedTransactions,
        prepareTransactions,
        updateSwapStatus,
        registerHandoff,
    }: AlgorandSwapExecutionContext,
): Promise<ExecuteSwapResult> => {
    const quoteIdStr = quote.quoteIdStr
    if (!quoteIdStr) {
        return failed({ phase: 'prepare', reason: 'missing-quote-id' })
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
        return failed({
            phase: 'prepare',
            reason: 'asset-frozen',
            assetId: isInFrozen
                ? quote.assetIn.assetId
                : quote.assetOut.assetId,
        })
    }

    // A quote that outlived its TTL (e.g. the confirm sat behind an offline
    // gap) must never reach prepare — the rate it shows is no longer the rate
    // that would execute.
    if (!isQuoteFresh(quote)) {
        return { kind: 'stale-quote' }
    }

    // Mirror of the backend's prepare-time balance validation, run here so a
    // shortfall fails with actionable copy before anything is signed — the
    // backend's own 400 for it is not machine-readable. Fail open on lookup
    // errors: the check is advisory, prepare and the node still validate.
    // Reported as 'preparing' so the sheet's close gesture cancels instead of
    // dismissing over a still-running execution.
    if (account) {
        onProgress('preparing')
        let shortfall: Nullable<Decimal> = null
        try {
            const info = await algorandClient.client.algod
                .accountInformation(account.address)
                .do()
            const holdsAssetOut =
                quote.assetOut.assetId === ALGO_ASSET_ID ||
                (info.assets ?? []).some(
                    holding =>
                        String(holding.assetId) === quote.assetOut.assetId,
                )
            shortfall = computeSwapAlgoShortfall({
                quote,
                algoBalance: new Decimal(info.amount.toString()),
                minBalance: new Decimal(info.minBalance.toString()),
                optInMbr: holdsAssetOut
                    ? undefined
                    : new Decimal(assetMbr.toString()),
            })
        } catch (e) {
            logger.warn('[swap] balance preflight lookup failed', {
                error: `${e}`,
            })
        }
        if (isCancelled()) {
            return { kind: 'cancelled' }
        }
        if (shortfall) {
            return failed({
                phase: 'prepare',
                reason: 'insufficient-native-balance',
                shortfall,
            })
        }
    }

    let prepareResult: Optional<PrepareTransactionsResult>
    try {
        onProgress('preparing')
        prepareResult = await prepareTransactions({ quote: quoteIdStr })
    } catch (e) {
        return failed({ phase: 'prepare', reason: 'prepare-failed', error: e })
    }

    // The user backed out while prepare was in flight — nothing has been
    // signed or broadcast, so abandoning here is safe. Without this check a
    // slow prepare would resume into the signing sheet with nobody watching.
    if (isCancelled()) {
        return { kind: 'cancelled' }
    }

    // A rebuild after a possibly-false failure would produce a new txid algod
    // can't dedupe — refuse while an earlier attempt is still open. The sender
    // must match the one the ledger row was recorded with, so when no sender
    // is known the guard is skipped rather than matched against a blank.
    //
    // Deliberately sender-wide rather than keyed on the swapId: a refused
    // retry goes stale within SWAP_QUOTE_TTL_MS, the form re-quotes, and the
    // backend hands back a NEW swap_id — an intent lookup would miss the very
    // row it was meant to catch. Both flows, because a shared-account swap
    // records its row under 'cosign' and a swap-only filter would miss a
    // re-proposed multisig retry.
    const swapSender = account?.address ?? quote.swapperAddress ?? undefined
    if (swapSender) {
        const unevaluatableBefore = Date.now() - STALE_OPEN_ATTEMPT_MS
        let blocked: boolean
        try {
            const openAttempts = await getOpenSubmissionAttempts({
                network,
                sender: swapSender,
                flows: ['swap', 'cosign'],
                unevaluatableBefore,
            })
            blocked = openAttempts.length > 0
        } catch (error) {
            // Fail closed: an escaping SQLite error would hang the confirmation
            // sheet on its spinner, and failing open would let a rebuild
            // broadcast unguarded.
            logger.warn('swap: rebuild guard lookup failed, refusing', {
                error,
            })
            blocked = true
        }
        if (blocked) {
            return { kind: 'verifying-previous' }
        }
    }

    const groups = prepareResult.transactionGroups ?? []
    if (groups.length === 0) {
        return failed({ phase: 'prepare', reason: 'no-transaction-groups' })
    }

    // `groupContext` is the full ordered list (pre-signed + user-signable,
    // every group concatenated) — required by the signing-machine analyzer's
    // group-integrity check, which recomputes the group hash over the same
    // payload the backend signed.
    const { plans, unsignedTxs, groupContext } = buildGroupPlans(groups, {
        decodeTransaction,
        decodeSignedTransaction,
    })

    // Fail-closed: the prepared group is backend-built and these flows skip
    // the standard signing review sheet, so verify it only spends what the
    // reviewed quote implies before signing it.
    try {
        const signableDisplayable = unsignedTxs
            .map(mapToDisplayableTransaction)
            .filter((tx): tx is PeraDisplayableTransaction => tx !== null)
        validateSwapGroupAgainstQuote(signableDisplayable, quote)
    } catch (e) {
        // Raw text goes to the log only; it must never reach the toast body.
        logger.warn('[swap] validation failed', { error: `${e}` })
        void reportSwapFailure(updateSwapStatus, prepareResult.swapIdStr)
        return failed({ phase: 'prepare', reason: 'quote-mismatch' })
    }

    // Shared-account (multisig) branch. Only the proposer's local key(s) are
    // available, so propose a `sync` multisig sign-request (backend collects
    // sigs but won't broadcast) and register a persisted handoff. The cosign
    // resolver assembles the composite multisig, interleaves the pre-signed
    // slots, and submits once the co-signer approves. Skipped when every slot
    // is pre-signed (nothing to co-sign).
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
            onProgress('signing')
            const serializedPlan = serializeGroupPlans(
                plans,
                encodeSignedTransactions,
                encodeToBase64,
            )
            await requestSwapProposal(
                addSignRequest,
                signer,
                signingSource,
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
                        expectedRawTransactionsBase64: rawTransactionsBase64,
                        registeredAt: Date.now(),
                    })
                },
            )
            return { kind: 'pending-cosign' }
        } catch (e) {
            if (isUserRejectionError(e)) {
                return { kind: 'user-rejected' }
            }
            logger.warn('[swap] propose failed', { error: `${e}` })
            void reportSwapFailure(updateSwapStatus, swapIdStr)
            return signingFailure(e)
        }
    }

    // Skip the pipeline entirely when every txn is already pre-signed — the
    // quantum guard inside `requestSwapSignatures` therefore doesn't run in
    // that shape either, which is correct: there is nothing left for the
    // account to sign, so no fee to raise and no signature to invalidate.
    let flatSigned: PeraSignedTransaction[]
    try {
        onProgress('signing')
        flatSigned =
            unsignedTxs.length > 0
                ? await requestSwapSignatures(
                      addSignRequest,
                      signer,
                      signingSource,
                      unsignedTxs,
                      groupContext,
                      { isQuantumSwapEnabled },
                  )
                : []
    } catch (e) {
        if (isUserRejectionError(e)) {
            return { kind: 'user-rejected' }
        }
        logger.warn('[swap] signing failed', { error: `${e}` })
        void reportSwapFailure(updateSwapStatus, prepareResult.swapIdStr)
        return signingFailure(e)
    }

    const allSignedGroups = scatterSigned(plans, flatSigned)
    const txIds: string[] = []
    try {
        onProgress('submitting')
        for (const signedGroup of allSignedGroups) {
            if (signedGroup.length === 0) continue
            const ids = await submitAndAutoRefresh(
                algorandClient,
                encodeSignedTransactions,
                signedGroup,
                {
                    flow: 'swap',
                    // No swapId means no stable identity — a blank key would
                    // collide unrelated swaps, and the rebuild guard skips
                    // them anyway.
                    intentKey: prepareResult.swapIdStr
                        ? { kind: 'swap', swapId: prepareResult.swapIdStr }
                        : undefined,
                    sender: account?.address ?? quote.swapperAddress,
                },
            )
            txIds.push(...ids)
        }
    } catch (e) {
        void reportSwapFailure(updateSwapStatus, prepareResult.swapIdStr)
        return failed({
            phase: 'submission',
            reason: 'submission-failed',
            error: e,
        })
    }

    try {
        onProgress('updating-status')
        if (prepareResult.swapIdStr) {
            await updateSwapStatus({
                swapId: prepareResult.swapIdStr,
                data: {
                    status: 'in_progress',
                    submitted_transaction_ids: txIds,
                    swap_version: 'v2',
                },
            })
        }
    } catch {
        // Non-fatal: the transactions are already on chain.
        logger.warn(
            'Failed to update swap status, transactions already submitted',
        )
    }

    return { kind: 'success', txIds }
}
