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
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    addSignature,
    getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey,
    useMarkSignRequestsConfirmedMutation,
    type SignRequestResponse,
} from '@perawallet/wallet-core-multisig'
import {
    classifyHandoffPoll,
    submitRawSignedTransactionGroup,
    useHandoffResolver,
    type TerminalHandoffOutcome,
} from '@perawallet/wallet-core-signing'
import { resolveSwapHandoffOutcome } from '../utils'
import { useSwapHandoffStore } from '../store'
import type { SwapHandoffRecord } from '../models'
import { useUpdateSwapStatusMutation } from './useUpdateSwapStatusMutation'

/** Stable accessors (module-level so the core's filter memo isn't busted). */
const handoffKey = (handoff: SwapHandoffRecord): string => handoff.signRequestId
const handoffNetwork = (
    handoff: SwapHandoffRecord,
): SwapHandoffRecord['network'] => handoff.network

const handoffExpiresAt = (detail: SignRequestResponse): number | null => {
    const expiresAt = new Date(detail.expected_expire_datetime).getTime()
    return Number.isNaN(expiresAt) ? null : expiresAt
}

const handoffRegisteredAt = (handoff: SwapHandoffRecord): number =>
    handoff.registeredAt

export type UseSwapCosignResolverArgs = {
    /** Polling pauses when false (e.g. app backgrounded — iOS suspends timers). */
    isAppActive: boolean
    /**
     * Surface a terminal failure to the user. Injected from the app layer
     * (e.g. the error-toast dispatcher) so this hook stays free of UI deps.
     */
    reportError: (error: unknown) => void
}

/**
 * Completes shared-account (multisig) swaps once the co-signer has signed.
 *
 * The swap analogue of `useWalletConnectHandoffResolver`: a thin adapter over
 * the shared {@link useHandoffResolver}. It sources handoffs from the
 * **persisted** store (so a swap co-signed while the proposer's app was closed
 * is finished on next launch — iOS can't keep a background service alive the
 * way Android does), opts into the active-network filter (submission must never
 * target the wrong algod after a network switch — others wait until the user
 * switches back), and on a terminal outcome hands off to
 * {@link resolveSwapHandoffOutcome}, which assembles the composite multisig,
 * interleaves the pre-signed slots, submits to algod, and reports swap status.
 *
 * Mounted once at the app root (the app wraps this with `AppState` →
 * `isAppActive` and an error-toast → `reportError`).
 */
export const useSwapCosignResolver = ({
    isAppActive,
    reportError,
}: UseSwapCosignResolverArgs): void => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const algorandClient = useAlgorandClient()
    const { mutateAsync: updateSwapStatus } = useUpdateSwapStatusMutation()
    const { markConfirmed } = useMarkSignRequestsConfirmedMutation()

    const handoffsMap = useSwapHandoffStore(s => s.handoffs)
    const markHandoffSubmitted = useSwapHandoffStore(
        s => s.markHandoffSubmitted,
    )
    const removeHandoff = useSwapHandoffStore(s => s.removeHandoff)

    const handoffs = useMemo(() => Object.values(handoffsMap), [handoffsMap])

    const poll = useCallback(
        (handoff: SwapHandoffRecord) => ({
            queryKey: getSignRequestsWithSignaturesQueryKey(
                handoff.network,
                handoff.signRequestId,
            ),
            queryFn: () =>
                getSignRequestsWithSignatures(handoff.network, {
                    device_id: deviceId ?? '',
                    proposed_sign_request_ids: [handoff.signRequestId],
                }),
            select: (data: SignRequestResponse[]) =>
                data.find(item => item.id === handoff.signRequestId),
            enabled: isAppActive && !!deviceId,
        }),
        [deviceId, isAppActive],
    )

    const classify = useCallback(
        (detail: SignRequestResponse, handoff: SwapHandoffRecord) => {
            // Crash-recovered record whose group already landed on chain: skip
            // classification entirely — no signature re-verification, and no
            // stall if the backend has pruned payloads or moved the request to
            // a post-submit status. The resolver's already-submitted branch
            // ignores the outcome (and these empty bytes) and just replays the
            // post-submit tail.
            if (handoff.submission) {
                return Promise.resolve({
                    kind: 'ready' as const,
                    assembledBytes: [],
                })
            }
            return classifyHandoffPoll(detail, {
                multisigAddress: handoff.multisigAddress,
                msigMetadata: handoff.msigMetadata,
                expectedRawTransactionsBase64:
                    handoff.expectedRawTransactionsBase64,
            })
        },
        [],
    )

    const resolve = useCallback(
        (
            outcome: TerminalHandoffOutcome,
            handoff: SwapHandoffRecord,
            detail: SignRequestResponse | undefined,
        ) => {
            // Proposer address from the poll — the only local participant
            // allowed to cancel the request on a terminal failure. Absent when
            // a client-side deadline fires with no poll body: the decline is
            // best-effort and simply skipped below.
            const proposerAddress = detail?.proposer_address ?? undefined

            return resolveSwapHandoffOutcome({
                outcome,
                record: handoff,
                deps: {
                    submitGroup: bytes =>
                        submitRawSignedTransactionGroup(algorandClient, bytes),
                    markSubmitted: txIds =>
                        markHandoffSubmitted(handoff.signRequestId, txIds),
                    decodeBase64: decodeFromBase64,
                    updateSwapStatus,
                    markConfirmed,
                    removeHandoff,
                    reportError,
                    // Cancel the proposer's own request (decline = the final
                    // word) so the pending sheet/inbox go terminal. Best-effort:
                    // skipped if the backend didn't echo a proposer address or
                    // the device id isn't ready.
                    declineSignRequest: async (signRequestId: string) => {
                        if (!proposerAddress || !deviceId) return
                        await addSignature(handoff.network, signRequestId, [
                            {
                                address: proposerAddress,
                                response: 'declined',
                                device_id: deviceId,
                            },
                        ])
                    },
                },
            })
        },
        [
            algorandClient,
            deviceId,
            updateSwapStatus,
            markConfirmed,
            markHandoffSubmitted,
            removeHandoff,
            reportError,
        ],
    )

    useHandoffResolver<
        SwapHandoffRecord,
        SignRequestResponse[],
        SignRequestResponse
    >({
        handoffs,
        keyOf: handoffKey,
        poll,
        classify,
        resolve,
        activeNetwork: network,
        networkOf: handoffNetwork,
        expiresAtOf: handoffExpiresAt,
        registeredAtOf: handoffRegisteredAt,
    })
}
