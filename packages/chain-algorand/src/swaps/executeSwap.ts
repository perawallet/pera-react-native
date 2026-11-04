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
    toScopeKey,
    type SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    mapToDisplayableTransaction,
    type getAlgorandClient,
} from '../blockchain'
import {
    getHoldingRestriction,
    isMultisigAccount,
} from '@perawallet/wallet-core-accounts'
import {
    getOpenSubmissionAttempts,
    STALE_OPEN_ATTEMPT_MS,
    submitAndAutoRefresh,
} from '@perawallet/wallet-core-signing'
import { algorandMultisigOf } from '../accounts/multisig-participants'
import { algorandAddressOf } from '../accounts/vocabulary'
import { isAlgorandNativeAssetId } from '../descriptor'
import { toUnsignedAlgorandTransactions } from '../signing/unsignedTransaction'
import {
    encodeToBase64,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    isQuoteFresh,
    isSwapQuoteGoneError,
    signableStepsOn,
    type ExecuteSwapParams,
    type ExecuteSwapResult,
    type SwapExecutionContext,
    type SwapExecutionFailure,
    type SwapOrder,
    type SwapReportedTransaction,
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
    reportSwapCancelled,
    requestSwapProposal,
    requestSwapSignatures,
} from './swapExecutionHelpers'
import { type AlgorandNetworkId } from '../network-id'
import type {
    PeraDisplayableTransaction,
    PeraSignedTransaction,
    PeraTransaction,
} from '../blockchain/models/algosdk-shapes'

export type AlgorandSwapExecutionContext = SwapExecutionContext & {
    network: AlgorandNetworkId
    algorandClient: ReturnType<typeof getAlgorandClient>
    /** Asset opt-in minimum balance, in microAlgos. */
    assetMbr: bigint
    /** Whether a quantum signer may swap; see `isAlgorandQuantumSwapEnabled`. */
    isQuantumSwapEnabled: boolean
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
 * Runs a quote through preflight → order → sign → submit → order report.
 * Never throws for an expected failure — every user-visible outcome is a
 * result — but an unexpected decode error still escapes.
 */
export const executeAlgorandSwap = async (
    {
        quote,
        account,
        signer,
        signingSource,
        onProgress,
        isCancelled,
    }: ExecuteSwapParams,
    {
        scope,
        algorandClient,
        assetMbr,
        isQuantumSwapEnabled,
        deviceId,
        addSignRequest,
        decodeTransaction,
        decodeSignedTransaction,
        encodeSignedTransactions,
        createOrder,
        reportOrder,
        registerHandoff,
    }: AlgorandSwapExecutionContext,
): Promise<ExecuteSwapResult> => {
    const accountAddress = account ? algorandAddressOf(account) : undefined
    // A cross-chain output lands on another chain: this account never holds
    // it, so neither its freeze state nor its opt-in applies here.
    const isAssetOutOnScope =
        accountAddress !== undefined &&
        toScopeKey(quote.assetOut.ref) === toScopeKey(scope)

    const [inRestriction, outRestriction] = accountAddress
        ? await Promise.all([
              getHoldingRestriction({
                  accountAddress,
                  assetId: quote.assetIn.assetId,
                  scope,
              }),
              isAssetOutOnScope
                  ? getHoldingRestriction({
                        accountAddress,
                        assetId: quote.assetOut.assetId,
                        scope,
                    })
                  : null,
          ])
        : [null, null]
    const isInFrozen = inRestriction !== null
    const isOutFrozen = outRestriction !== null

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
    // gap) must never reach an order — the rate it shows is no longer the rate
    // that would execute.
    if (!isQuoteFresh(quote)) {
        return { kind: 'stale-quote' }
    }

    // Mirror of the backend's order-time balance validation, run here so a
    // shortfall fails with actionable copy before anything is signed — the
    // backend's own 400 for it is not machine-readable. Fail open on lookup
    // errors: the check is advisory, the order and the node still validate.
    // Reported as 'preparing' so the sheet's close gesture cancels instead of
    // dismissing over a still-running execution.
    if (accountAddress) {
        onProgress('preparing')
        let shortfall: Nullable<Decimal> = null
        try {
            const info = await algorandClient.client.algod
                .accountInformation(accountAddress)
                .do()
            const holdsAssetOut =
                !isAssetOutOnScope ||
                isAlgorandNativeAssetId(quote.assetOut.assetId) ||
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
                chainId: scope.chainId,
                shortfall,
            })
        }
    }

    let order: SwapOrder
    try {
        onProgress('preparing')
        order = await createOrder(quote.quoteId)
    } catch (e) {
        // The router already spent or forgot the quote: re-quote, as for a
        // quote past its client TTL.
        if (isSwapQuoteGoneError(e)) return { kind: 'stale-quote' }
        return failed({ phase: 'prepare', reason: 'prepare-failed', error: e })
    }
    const { orderId } = order
    const cancelOrder = (): void => {
        void reportSwapCancelled(reportOrder, orderId)
    }

    // The user backed out while the order was in flight — nothing has been
    // signed or broadcast, so abandoning here is safe. Without this check a
    // slow order would resume into the signing sheet with nobody watching.
    if (isCancelled()) {
        cancelOrder()
        return { kind: 'cancelled' }
    }

    // A rebuild after a possibly-false failure would produce a new txid algod
    // can't dedupe — refuse while an earlier attempt is still open. The sender
    // must match the one the ledger row was recorded with, so when no sender
    // is known the guard is skipped rather than matched against a blank.
    //
    // Deliberately sender-wide rather than keyed on the order id: a refused
    // retry goes stale within SWAP_QUOTE_TTL_MS, the form re-quotes, and the
    // router hands back a NEW order id — an intent lookup would miss the very
    // row it was meant to catch. Both flows, because a shared-account swap
    // records its row under 'cosign' and a swap-only filter would miss a
    // re-proposed multisig retry.
    const swapSender = accountAddress ?? quote.request.sourceAddress
    if (swapSender) {
        const unevaluatableBefore = Date.now() - STALE_OPEN_ATTEMPT_MS
        let blocked: boolean
        try {
            const openAttempts = await getOpenSubmissionAttempts({
                scope,
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
            cancelOrder()
            return { kind: 'verifying-previous' }
        }
    }

    // Runs only a whole order on this chain: a step it can't run, or one on
    // another chain, refuses the order before anything is signed.
    const steps = signableStepsOn(order, scope.chainId)
    if (!steps) {
        cancelOrder()
        return failed({ phase: 'prepare', reason: 'unsupported-steps' })
    }
    if (steps.length === 0) {
        cancelOrder()
        return failed({ phase: 'prepare', reason: 'no-signable-steps' })
    }

    // `groupContext` is the full ordered list (pre-signed + user-signable,
    // every group concatenated) — required by the signing-machine analyzer's
    // group-integrity check, which recomputes the group hash over the same
    // payload the backend signed.
    const { plans, unsignedTxs, groupContext } = buildGroupPlans(steps, {
        decodeTransaction,
        decodeSignedTransaction,
    })

    // Fail-closed: the prepared group is backend-built and these flows skip
    // the standard signing review sheet, so verify it only spends what the
    // app asked for before signing it.
    try {
        const signableDisplayable = unsignedTxs
            .map(mapToDisplayableTransaction)
            .filter((tx): tx is PeraDisplayableTransaction => tx !== null)
        validateSwapGroupAgainstQuote(signableDisplayable, quote)
    } catch (e) {
        // Raw text goes to the log only; it must never reach the toast body.
        logger.warn('[swap] validation failed', { error: `${e}` })
        cancelOrder()
        return failed({ phase: 'prepare', reason: 'quote-mismatch' })
    }

    // Shared-account (multisig) branch. Only the proposer's local key(s) are
    // available, so propose a `sync` multisig sign-request (backend collects
    // sigs but won't broadcast) and register a persisted handoff. The cosign
    // resolver assembles the composite multisig, interleaves the pre-signed
    // slots, and submits once the co-signer approves. Skipped when every slot
    // is pre-signed (nothing to co-sign).
    const multisigParameters =
        account && isMultisigAccount(account)
            ? algorandMultisigOf(account)
            : undefined
    if (multisigParameters && accountAddress && unsignedTxs.length > 0) {
        const { threshold, addresses } = multisigParameters
        const multisigAddress = accountAddress
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
                toUnsignedAlgorandTransactions(unsignedTxs, scope),
                toUnsignedAlgorandTransactions(groupContext, scope),
                ({ signRequestId, rawTransactionsBase64 }) => {
                    registerHandoff({
                        swapIdStr: orderId,
                        signRequestId,
                        scope,
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
            cancelOrder()
            if (isUserRejectionError(e)) {
                return { kind: 'user-rejected' }
            }
            logger.warn('[swap] propose failed', { error: `${e}` })
            return signingFailure(e)
        }
    }

    // Skip the pipeline entirely when every txn is already pre-signed — the
    // quantum guard inside `requestSwapSignatures` therefore doesn't run in
    // that shape either, which is correct: there is nothing left for the
    // account to sign, so no fee to raise and no signature to invalidate.
    let flatSigned: SignedTransaction[]
    try {
        onProgress('signing')
        flatSigned =
            unsignedTxs.length > 0
                ? await requestSwapSignatures(
                      addSignRequest,
                      signer,
                      signingSource,
                      toUnsignedAlgorandTransactions(unsignedTxs, scope),
                      toUnsignedAlgorandTransactions(groupContext, scope),
                      { isQuantumSwapEnabled },
                  )
                : []
    } catch (e) {
        cancelOrder()
        if (isUserRejectionError(e)) {
            return { kind: 'user-rejected' }
        }
        logger.warn('[swap] signing failed', { error: `${e}` })
        return signingFailure(e)
    }

    // Re-encoded, as the backend's pre-signed slots always have been on submit.
    const allSignedGroups = scatterSigned(plans, flatSigned, signed => ({
        scope,
        id: signed.txn.txID(),
        bytes: encodeSignedTransactions([signed])[0],
    }))
    const txIds: string[] = []
    const reported: SwapReportedTransaction[] = []
    try {
        onProgress('submitting')
        for (const [index, signedGroup] of allSignedGroups.entries()) {
            if (signedGroup.length === 0) continue
            const ids = await submitAndAutoRefresh(scope, signedGroup, {
                flow: 'swap',
                intentKey: { kind: 'swap', swapId: orderId },
                sender: swapSender,
            })
            txIds.push(...ids)
            reported.push(
                ...ids.map(txHash => ({
                    scope,
                    txHash,
                    purpose: plans[index].purpose,
                })),
            )
        }
    } catch (e) {
        // A group may already be on chain; the router settles the order from
        // the chain, so nothing is reported.
        return failed({
            phase: 'submission',
            reason: 'submission-failed',
            error: e,
        })
    }

    try {
        onProgress('updating-status')
        await reportOrder({
            orderId,
            report: {
                status: 'sent',
                transactions: reported,
            },
        })
    } catch {
        // Non-fatal: the transactions are already on chain.
        logger.warn(
            'Failed to report the swap order, transactions already submitted',
        )
    }

    return { kind: 'success', orderId, txIds }
}
