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

import { useEffect, useMemo, useRef } from 'react'
import { useQueries, type QueryKey } from '@tanstack/react-query'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import type {
    HandoffPollOutcome,
    TerminalHandoffOutcome,
} from '../pipeline/classifyHandoffPoll'

/** Poll cadence while the backend is responding. */
const BASE_POLL_INTERVAL_MS = 3000
/** Slower cadence right after a failed poll, so a down backend isn't hammered. */
const ERROR_POLL_INTERVAL_MS = 30_000

/**
 * Longest a handoff is polled with no terminal status before the client
 * self-expires it. Only a backstop: the backend's authoritative per-request
 * `expected_expire_datetime` (via {@link UseHandoffResolverArgs.expiresAtOf})
 * is the real deadline whenever the backend has answered even once, so this
 * fixed cap effectively bites only when the backend never responds at all. Set
 * above the ~1h Algorand transaction-validity window that already bounds a
 * signable request, so it never pre-empts a legitimately slow multi-party sign.
 */
const FALLBACK_DEADLINE_MS = 60 * 60_000

/**
 * The wall-clock ms at which a still-unresolved handoff should self-expire: the
 * backend's authoritative expiry when known, else a fixed fallback measured
 * from registration. `min` so a pathologically long backend expiry can't defeat
 * the fallback. Returns null when neither bound is available (accessors unset),
 * i.e. deadline enforcement is opt-in per consumer.
 */
export const resolveHandoffDeadline = ({
    expiresAt,
    registeredAt,
    fallbackMs = FALLBACK_DEADLINE_MS,
}: {
    expiresAt: number | null
    registeredAt: number | null
    fallbackMs?: number
}): number | null => {
    const fallback = registeredAt === null ? null : registeredAt + fallbackMs
    if (expiresAt === null) return fallback
    if (fallback === null) return expiresAt
    return Math.min(expiresAt, fallback)
}

/**
 * The per-handoff poll a consumer supplies: the `with-signatures` request
 * (endpoint + params) plus its enablement gate. The cadence (a stateless
 * two-tier backoff) and cache policy are owned by the resolver, not here.
 */
export type HandoffPollDescriptor<TRaw, TDetail> = {
    queryKey: QueryKey
    queryFn: () => Promise<TRaw>
    /** Narrow the raw response to the single matching detail (or undefined). */
    select: (data: TRaw) => TDetail | undefined
    /** Poll only while true — e.g. app foregrounded and a device id is set. */
    enabled: boolean
}

export type UseHandoffResolverArgs<TItem, TRaw, TDetail> = {
    /** Handoffs to drive. The consumer sources these from its own registry. */
    handoffs: TItem[]
    /** Stable identity for a handoff — the sign-request id. */
    keyOf: (item: TItem) => string
    /** Build the poll for one handoff. */
    poll: (item: TItem) => HandoffPollDescriptor<TRaw, TDetail>
    /**
     * Classify a poll result into a (terminal or not) outcome. Async because
     * multisig classification verifies signatures, yielding between batches.
     */
    classify: (detail: TDetail, item: TItem) => Promise<HandoffPollOutcome>
    /**
     * Deliver / complete a terminal outcome exactly once. Receives the poll
     * `detail` too, for consumers that need a field the registry record does
     * not carry (e.g. the swap resolver reads the proposer address from it).
     * `detail` is `undefined` for a fallback-fired deadline (see
     * {@link registeredAtOf}) where the backend never returned a poll body.
     */
    resolve: (
        outcome: TerminalHandoffOutcome,
        item: TItem,
        detail: TDetail | undefined,
    ) => void | Promise<void>
    /**
     * The request's authoritative expiry (wall-clock ms) read from the latest
     * poll `detail`, or null when absent/unparseable. Enables the client-side
     * deadline: past it, an unresolved handoff self-expires to a clean
     * `soft-reject`. Omit to disable deadline enforcement.
     */
    expiresAtOf?: (detail: TDetail) => number | null
    /**
     * Registration timestamp (wall-clock ms) of a handoff, anchoring the fixed
     * fallback deadline that bounds a handoff whose backend never responds.
     * Omit to disable the fallback.
     */
    registeredAtOf?: (item: TItem) => number
    /**
     * When set (together with {@link networkOf}), only handoffs on this network
     * are driven — others wait until the active network switches back. Consumers
     * that submit to algod opt in so submission never targets the wrong node;
     * consumers that only hand bytes back to a peer (WalletConnect) leave it
     * unset and drive every handoff on its own captured network.
     */
    activeNetwork?: Network
    networkOf?: (item: TItem) => Network
}

/**
 * Shared lifecycle for resolving multisig sign-request handoffs, used by both
 * the WalletConnect sync-flow resolver and the shared-account swap resolver.
 *
 * Owns the parts both consumers share verbatim: one `useQueries` poll per
 * handoff with a stateless two-tier backoff cadence, an optional active-network
 * filter, a `resolvedRef` guard (pruned to the live set) that delivers each
 * terminal outcome exactly once even if a late poll lands before the registry
 * re-render, and the `classify → resolve` dispatch. Consumers supply only their
 * registry source, the per-handoff poll, and the terminal `resolve`.
 */
export const useHandoffResolver = <TItem, TRaw, TDetail>({
    handoffs,
    keyOf,
    poll,
    classify,
    resolve,
    activeNetwork,
    networkOf,
    expiresAtOf,
    registeredAtOf,
}: UseHandoffResolverArgs<TItem, TRaw, TDetail>): void => {
    // Opt-in active-network filter. Without it, every handoff is driven on its
    // own captured network (the WalletConnect behavior).
    const active = useMemo(() => {
        if (activeNetwork === undefined || networkOf === undefined) {
            return handoffs
        }
        return handoffs.filter(item => networkOf(item) === activeNetwork)
    }, [handoffs, activeNetwork, networkOf])

    // Sign-request ids that have delivered a terminal outcome, or are mid-
    // classification and may still deliver one — guards against a late poll
    // re-delivering before the registry-remove re-render lands. A non-terminal
    // outcome hands its claim back. Pruned to the live set in the effect below.
    const resolvedRef = useRef<Set<string>>(new Set())

    // One poll query per handoff. `useQueries` handles the dynamic count;
    // results stay index-aligned with `active`.
    const queries = useMemo(
        () =>
            active.map(item => {
                const descriptor = poll(item)
                return {
                    ...descriptor,
                    staleTime: 0,
                    gcTime: 0,
                    // `fetchFailureCount` resets every fetch — each interval
                    // poll is a fresh fetch — so a stateless two-tier cadence
                    // stands in for an exponential backoff: fast while healthy,
                    // slow right after an error.
                    refetchInterval: (query: { state: { status: string } }) =>
                        query.state.status === 'error'
                            ? ERROR_POLL_INTERVAL_MS
                            : BASE_POLL_INTERVAL_MS,
                }
            }),
        [active, poll],
    )

    const results = useQueries({ queries })

    useEffect(() => {
        // Drop guard entries for handoffs that have left the active set so the
        // set stays bounded across a long-lived session.
        const activeIds = new Set(active.map(keyOf))
        for (const id of resolvedRef.current) {
            if (!activeIds.has(id)) resolvedRef.current.delete(id)
        }

        results.forEach((result, index) => {
            const item = active[index]
            if (!item) return

            const key = keyOf(item)
            if (resolvedRef.current.has(key)) return

            const detail = result.data as TDetail | undefined

            // Client-side wall-clock cap. Nothing terminalizes a handoff if the
            // backend never emits a terminal status (a dropped dApp session, or
            // a request left pending past its expiry), so self-expire it to a
            // clean `soft-reject` once the deadline passes. Checked before the
            // `!detail` guard so a backend that never returns a body still
            // resolves via the registration fallback. Latency is one poll
            // interval — the effect re-runs on every poll (≤3s healthy, ≤30s
            // erroring); acceptable for an already-overdue request.
            const deadline = resolveHandoffDeadline({
                expiresAt: detail && expiresAtOf ? expiresAtOf(detail) : null,
                registeredAt: registeredAtOf ? registeredAtOf(item) : null,
            })
            if (deadline !== null && Date.now() >= deadline) {
                resolvedRef.current.add(key)
                void resolve(
                    { kind: 'soft-reject', reason: 'expired' },
                    item,
                    detail,
                )
                return
            }

            if (!detail) return

            // Claim BEFORE awaiting classification, which yields to the JS
            // thread while verifying bulk multisig signatures: releasing the
            // guard only after the await would let two effect runs both pass
            // the `has` check above and resolve the same handoff twice. Any
            // non-terminal outcome hands the claim back below.
            resolvedRef.current.add(key)
            void (async () => {
                let outcome: HandoffPollOutcome
                try {
                    outcome = await classify(detail, item)
                } catch (error) {
                    // Classification reports real failures as an `error`
                    // outcome rather than throwing, so a rejection here is a
                    // transient fault — unclaim so the next poll retries
                    // instead of stranding the handoff as resolved. Logged
                    // because the retry is silent otherwise: a fault that never
                    // clears would poll forever with nothing to show for it.
                    logger.warn('Handoff classification threw; will retry', {
                        signRequestId: key,
                        error,
                    })
                    resolvedRef.current.delete(key)
                    return
                }

                if (outcome.kind === 'keep-polling') {
                    resolvedRef.current.delete(key)
                    return
                }

                await resolve(outcome, item, detail)
            })()
        })
    }, [results, active, keyOf, classify, resolve, expiresAtOf, registeredAtOf])
}
