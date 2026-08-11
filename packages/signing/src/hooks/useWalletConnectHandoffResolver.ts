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

import { useCallback, useMemo } from 'react'
import {
    addSignature,
    getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey,
    useMarkSignRequestsConfirmedMutation,
    type SignRequestResponse,
} from '@perawallet/wallet-core-multisig'
import {
    classifyHandoffPoll,
    resolveHandoffOutcome,
    type HandoffPeerDelivery,
    type ResolverMessages,
    type TerminalHandoffOutcome,
} from '../pipeline/classifyHandoffPoll'
import type { PendingWalletConnectHandoff } from '../pipeline/walletConnectHandoffs'
import { useWalletConnectHandoffsStore } from '../store/walletConnectHandoffsStore'
import { useHandoffResolver } from './useHandoffResolver'

/** Stable accessors (module-level so the core's dispatch effect isn't churned). */
const handoffKey = (handoff: PendingWalletConnectHandoff): string =>
    handoff.signRequestId

const handoffExpiresAt = (detail: SignRequestResponse): number | null => {
    const expiresAt = new Date(detail.expected_expire_datetime).getTime()
    return Number.isNaN(expiresAt) ? null : expiresAt
}

const handoffRegisteredAt = (handoff: PendingWalletConnectHandoff): number =>
    handoff.registeredAt

export type UseWalletConnectHandoffResolverArgs = {
    /**
     * Polling pauses when false (e.g. app backgrounded). A backgrounded
     * poll would only fail (suspended network) and could not be delivered
     * anyway (suspended WC socket).
     */
    isAppActive: boolean
    /** Localized strings delivered to the dApp on terminal outcomes. */
    messages: ResolverMessages
    /**
     * Answers the WC peer, keyed by the handoff's serializable clientId /
     * payloadId. Injected from the app layer so this hook stays free of any
     * WalletConnect dependency and works identically for a handoff resumed
     * after an app kill (no in-memory closures to replay).
     */
    delivery: HandoffPeerDelivery
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
 * A thin adapter over {@link useHandoffResolver}: it sources handoffs from the
 * in-memory registry and delivers terminal outcomes to the dApp. No
 * active-network filter — every handoff is polled on its own captured network
 * and delivered to the peer regardless of the wallet's current network. The
 * registry is in-memory, so an app kill drops tracking; the on-chain
 * sign-request still exists and the user can finish it from the inbox flow.
 *
 * Platform-agnostic — callers pass `isAppActive` and `messages` so the
 * hook itself has no `react-native` or `react-i18next` dependency.
 */
export const useWalletConnectHandoffResolver = ({
    isAppActive,
    messages,
    delivery,
}: UseWalletConnectHandoffResolverArgs): void => {
    // Re-render whenever a handoff is registered / unregistered. The store
    // swaps the `handoffs` dict reference on every change, so the default
    // selector identity check fires for the events we care about.
    const handoffsMap = useWalletConnectHandoffsStore(s => s.handoffs)
    const handoffs = useMemo(() => Object.values(handoffsMap), [handoffsMap])

    const { markConfirmed } = useMarkSignRequestsConfirmedMutation()

    const poll = useCallback(
        (handoff: PendingWalletConnectHandoff) => ({
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
        }),
        [isAppActive],
    )

    const resolve = useCallback(
        (
            outcome: TerminalHandoffOutcome,
            handoff: PendingWalletConnectHandoff,
            detail: SignRequestResponse | undefined,
        ) => {
            // Proposer address from the poll — the only local participant
            // allowed to cancel the request on a terminal failure. Absent when
            // a client-side deadline fires with no poll body: the cancel is
            // best-effort and simply skipped below.
            const proposerAddress = detail?.proposer_address ?? undefined

            return resolveHandoffOutcome({
                outcome,
                handoff,
                messages,
                delivery,
                markConfirmed,
                // Decline the proposer's own request (decline = the final
                // word) so the pending inbox item goes terminal instead of
                // sitting orphaned when the dApp session is gone.
                cancelRequest: async () => {
                    if (!proposerAddress) return
                    await addSignature(handoff.network, handoff.signRequestId, [
                        {
                            address: proposerAddress,
                            response: 'declined',
                            device_id: handoff.deviceId,
                        },
                    ])
                },
            })
        },
        [messages, delivery, markConfirmed],
    )

    useHandoffResolver<
        PendingWalletConnectHandoff,
        SignRequestResponse[],
        SignRequestResponse
    >({
        handoffs,
        keyOf: handoffKey,
        poll,
        classify: classifyHandoffPoll,
        resolve,
        expiresAtOf: handoffExpiresAt,
        registeredAtOf: handoffRegisteredAt,
    })
}
