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

import { useEffect, useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
    getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey,
    useMarkSignRequestsConfirmedMutation,
    type SignRequestResponse,
} from '@perawallet/wallet-core-multisig'
import {
    classifyHandoffPoll,
    resolveHandoffOutcome,
    type ResolverMessages,
} from '../pipeline/classifyHandoffPoll'
import { useWalletConnectHandoffsStore } from '../store/walletConnectHandoffsStore'

/** Poll cadence while the backend is responding. */
const BASE_POLL_INTERVAL_MS = 3000
/** Slower cadence right after a failed poll, so a down backend isn't hammered. */
const ERROR_POLL_INTERVAL_MS = 30_000

export type UseWalletConnectHandoffResolverArgs = {
    /**
     * Polling pauses when false (e.g. app backgrounded). A backgrounded
     * poll would only fail (suspended network) and could not be delivered
     * anyway (suspended WC socket).
     */
    isAppActive: boolean
    /** Localized strings delivered to the dApp on terminal outcomes. */
    messages: ResolverMessages
}

/**
 * Resolves WalletConnect sync-flow multisig handoffs.
 *
 * For each pending handoff registered by `createMultisigProposeTransport`,
 * polls `POST /sign-requests/with-signatures/` until a terminal status
 * arrives, then delivers the outcome to the dApp via the handoff's WC
 * callbacks:
 *   - `'ready'` / `'confirmed'`: assemble the composite multisig signed
 *     transaction(s) and hand them to `approveSignedBytes`.
 *   - `'declined'` / `'expired'`: `reject({ kind: 'softReject', error })` —
 *     a clean rejection with no in-app connection-error banner.
 *   - `'failed'`: `error` — the connection-error banner is appropriate.
 *
 * One `useQueries` poll per registered handoff. Mounted once at the app
 * root. The handoff registry is in-memory, so an app kill drops tracking —
 * the on-chain sign-request still exists and the user can finish it from
 * the inbox flow.
 *
 * Platform-agnostic — callers pass `isAppActive` and `messages` so the
 * hook itself has no `react-native` or `react-i18next` dependency.
 */
export const useWalletConnectHandoffResolver = ({
    isAppActive,
    messages,
}: UseWalletConnectHandoffResolverArgs): void => {
    // Re-render whenever a handoff is registered / unregistered. The store
    // swaps the `handoffs` dict reference on every change, so the default
    // selector identity check fires for the events we care about.
    const handoffsMap = useWalletConnectHandoffsStore(s => s.handoffs)
    const handoffs = useMemo(() => Object.values(handoffsMap), [handoffsMap])

    // Sign-request ids already delivered a terminal callback — guards
    // against a late poll re-delivering before the registry-unregister
    // re-render lands. Pruned to the live handoff set in the effect below.
    const resolvedRef = useRef<Set<string>>(new Set())

    const { markConfirmed } = useMarkSignRequestsConfirmedMutation()

    // One poll query per handoff. `useQueries` handles the dynamic count;
    // results stay index-aligned with `handoffs`.
    const queries = useMemo(
        () =>
            handoffs.map(handoff => ({
                queryKey: getSignRequestsWithSignaturesQueryKey(
                    handoff.network,
                    handoff.signRequestId,
                ),
                queryFn: () =>
                    getSignRequestsWithSignatures(handoff.network, {
                        device_id: handoff.deviceId,
                        proposed_sign_request_ids: [handoff.signRequestId],
                    }),
                select: (data: SignRequestResponse[]) =>
                    data.find(item => item.id === handoff.signRequestId),
                enabled: isAppActive,
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
            })),
        [handoffs, isAppActive],
    )

    const queryResults = useQueries({ queries })

    useEffect(() => {
        // Drop guard entries for handoffs that have left the registry so the
        // set stays bounded across a long-lived session.
        const activeIds = new Set(
            handoffs.map(handoff => handoff.signRequestId),
        )
        for (const id of resolvedRef.current) {
            if (!activeIds.has(id)) resolvedRef.current.delete(id)
        }

        queryResults.forEach((result, index) => {
            const handoff = handoffs[index]
            if (!handoff) return
            if (resolvedRef.current.has(handoff.signRequestId)) return

            const detail = result.data
            if (!detail) return

            const outcome = classifyHandoffPoll(detail, handoff)
            if (outcome.kind === 'keep-polling') return

            // Claim it synchronously so a re-render cannot re-deliver, then
            // hand the outcome to the dApp.
            resolvedRef.current.add(handoff.signRequestId)
            void resolveHandoffOutcome({
                outcome,
                handoff,
                messages,
                markConfirmed,
            })
        })
    }, [queryResults, handoffs, messages, markConfirmed])
}
