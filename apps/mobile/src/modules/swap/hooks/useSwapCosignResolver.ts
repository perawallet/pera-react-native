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
} from '@perawallet/wallet-core-signing'
import {
    useSwapHandoffStore,
    useUpdateSwapStatusMutation,
} from '@perawallet/wallet-core-swaps'
import { useErrorToast } from '@hooks/useErrorToast'
import { resolveSwapHandoffOutcome } from './resolveSwapHandoffOutcome'

/** Poll cadence while the backend is responding. */
const BASE_POLL_INTERVAL_MS = 3000
/** Slower cadence right after a failed poll, so a down backend isn't hammered. */
const ERROR_POLL_INTERVAL_MS = 30_000

export type UseSwapCosignResolverArgs = {
    /** Polling pauses when false (e.g. app backgrounded — iOS suspends timers). */
    isAppActive: boolean
}

/**
 * Completes shared-account (multisig) swaps once the co-signer has signed.
 *
 * Structurally the swap analogue of {@link useWalletConnectHandoffResolver}:
 * for every persisted handoff on the active network it polls
 * `POST /sign-requests/with-signatures/`, and on a terminal status hands the
 * classified outcome to {@link resolveSwapHandoffOutcome}, which assembles the
 * composite multisig, interleaves the pre-signed slots, submits to algod, and
 * reports swap status. Unlike the WC resolver the registry is **persisted**, so
 * a swap co-signed while the proposer's app was closed is finished on next
 * launch (iOS can't keep a background service alive the way Android does).
 *
 * Mounted once at the app root. Only handoffs on the active network are
 * processed, so submission never targets the wrong algod after a network
 * switch — others wait until the user switches back.
 */
export const useSwapCosignResolver = ({
    isAppActive,
}: UseSwapCosignResolverArgs): void => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const algorandClient = useAlgorandClient()
    const { mutateAsync: updateSwapStatus } = useUpdateSwapStatusMutation()
    const { markConfirmed } = useMarkSignRequestsConfirmedMutation()
    const { showError } = useErrorToast()

    const handoffsMap = useSwapHandoffStore(s => s.handoffs)
    const removeHandoff = useSwapHandoffStore(s => s.removeHandoff)

    // Only the active network's handoffs are pollable + submittable here.
    const handoffs = useMemo(
        () =>
            Object.values(handoffsMap).filter(
                handoff => handoff.network === network,
            ),
        [handoffsMap, network],
    )

    // Sign-request ids already resolved — guards against a late poll
    // re-submitting before the store-remove re-render lands.
    const resolvedRef = useRef<Set<string>>(new Set())

    const queries = useMemo(
        () =>
            handoffs.map(handoff => ({
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
                staleTime: 0,
                gcTime: 0,
                refetchInterval: (query: { state: { status: string } }) =>
                    query.state.status === 'error'
                        ? ERROR_POLL_INTERVAL_MS
                        : BASE_POLL_INTERVAL_MS,
            })),
        [handoffs, isAppActive, deviceId],
    )

    const queryResults = useQueries({ queries })

    useEffect(() => {
        const activeIds = new Set(handoffs.map(h => h.signRequestId))
        for (const id of resolvedRef.current) {
            if (!activeIds.has(id)) resolvedRef.current.delete(id)
        }

        queryResults.forEach((result, index) => {
            const handoff = handoffs[index]
            if (!handoff) return
            if (resolvedRef.current.has(handoff.signRequestId)) return

            const detail = result.data
            if (!detail) return

            const outcome = classifyHandoffPoll(detail, {
                multisigAddress: handoff.multisigAddress,
                msigMetadata: handoff.msigMetadata,
                expectedRawTransactionsBase64:
                    handoff.expectedRawTransactionsBase64,
            })
            if (outcome.kind === 'keep-polling') return

            // Proposer address from the poll — the only local participant
            // allowed to cancel the request on a terminal failure.
            const proposerAddress = detail.proposer_address ?? undefined

            // Claim synchronously so a re-render can't double-submit.
            resolvedRef.current.add(handoff.signRequestId)
            void resolveSwapHandoffOutcome({
                outcome,
                record: handoff,
                deps: {
                    submitGroup: bytes =>
                        submitRawSignedTransactionGroup(algorandClient, bytes),
                    decodeBase64: decodeFromBase64,
                    updateSwapStatus,
                    markConfirmed,
                    removeHandoff,
                    reportError: showError,
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
        })
    }, [
        queryResults,
        handoffs,
        algorandClient,
        deviceId,
        updateSwapStatus,
        markConfirmed,
        removeHandoff,
        showError,
    ])
}
