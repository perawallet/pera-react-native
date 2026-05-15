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

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import { AppState } from 'react-native'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey,
    useMarkSignRequestsConfirmedMutation,
    type SignRequestResponse,
} from '@perawallet/wallet-core-multisig'
import { walletConnectHandoffs } from '@perawallet/wallet-core-signing'
import {
    classifyHandoffPoll,
    resolveHandoffOutcome,
    type ResolverMessages,
} from '../utils/classifyHandoffPoll'

/** Poll cadence while the backend is responding. */
const BASE_POLL_INTERVAL_MS = 3000
/** Slower cadence right after a failed poll, so a down backend isn't hammered. */
const ERROR_POLL_INTERVAL_MS = 30000

/**
 * Resolves WalletConnect sync-flow multisig handoffs.
 *
 * For each pending handoff registered by `createMultisigProposeTransport`,
 * polls `POST /sign-requests/with-signatures/` until a terminal status
 * arrives, then delivers the outcome to the dApp via the handoff's WC
 * callbacks:
 *   - `'ready'` / `'confirmed'`: assemble the composite multisig signed
 *     transaction(s) and hand them to `approveSignedBytes`.
 *   - `'declined'` / `'expired'`: `softReject` — a clean rejection with no
 *     in-app connection-error banner.
 *   - `'failed'`: `error` — the connection-error banner is appropriate.
 *
 * One `useQueries` poll per registered handoff. Mounted once at the app
 * root. The handoff registry is in-memory, so an app kill drops tracking —
 * the on-chain sign-request still exists and the user can finish it from
 * the inbox flow.
 *
 * There is no Android analog: Android fetches sign-request status on demand
 * from a ViewModel when the user opens the joint-account screen. RN polls in
 * the background because the WC peer is blocked on `approveRequest` with no
 * UI surface to drive the fetch.
 */
export const useWalletConnectHandoffResolver = (): void => {
    const { t } = useTranslation()

    // Re-render whenever a handoff is registered / unregistered. The
    // snapshot is the registry's monotonic version, not its list length —
    // length would miss a same-tick unregister + register that collapses to
    // the same count.
    const version = useSyncExternalStore(
        walletConnectHandoffs.subscribe,
        walletConnectHandoffs.getVersion,
        () => 0,
    )
    const handoffs = useMemo(() => walletConnectHandoffs.list(), [version])

    const messages = useMemo<ResolverMessages>(
        () => ({
            declined: t('multisig.sync_sign.errors.declined'),
            expired: t('multisig.sync_sign.errors.expired'),
            failed: t('multisig.sync_sign.errors.failed'),
            noTransactions: t('multisig.sync_sign.errors.no_transactions'),
            deliveryFailed: t('multisig.sync_sign.errors.delivery_failed'),
            assemblyFailed: (reason: string) =>
                t('multisig.sync_sign.errors.assembly_failed', { reason }),
        }),
        [t],
    )

    // Polling pauses while the app is backgrounded — the multisig flow
    // inherently backgrounds the wallet while the user signs their other
    // participant, and a backgrounded poll would only fail (suspended
    // network) and could not be delivered (suspended WC socket).
    const [isAppActive, setIsAppActive] = useState(
        AppState.currentState === 'active',
    )
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            setIsAppActive(nextState === 'active')
        })
        return () => subscription.remove()
    }, [])

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
