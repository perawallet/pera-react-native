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

import { useCallback, useEffect, useMemo } from 'react'
import type { WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'
import { SESSION_REQUEST_TTL_MS } from '../constants'

/**
 * A queued session request is only approvable while the dApp's side of
 * the handshake can still be listening. Requests without a `createdAt`
 * stamp (constructed outside `addSessionRequest`) are treated as fresh.
 */
export const isSessionRequestFresh = (
    request: WalletConnectSessionRequest,
    nowMs: number = Date.now(),
): boolean =>
    request.createdAt === undefined ||
    nowMs - request.createdAt <= SESSION_REQUEST_TTL_MS

export const useWalletConnectSessionRequests = () => {
    const allSessionRequests = useWalletConnectStore(
        state => state.sessionRequests,
    )
    const setSessionRequests = useWalletConnectStore(
        state => state.setSessionRequests,
    )

    const sessionRequests = useMemo(
        () =>
            allSessionRequests.filter(request =>
                isSessionRequestFresh(request),
            ),
        [allSessionRequests],
    )

    // Physically drop expired entries so no consumer of the raw store
    // (e.g. the pairing outcome waiter) can resurrect a stale request.
    useEffect(() => {
        if (sessionRequests.length !== allSessionRequests.length) {
            setSessionRequests(sessionRequests)
        }
    }, [sessionRequests, allSessionRequests, setSessionRequests])

    // Both mutators read live store state at call time rather than the
    // render-time snapshot: connector event handlers capture them once, at
    // connect()/bind time, and that frozen closure would otherwise clobber
    // every add/remove that happened since binding (dropping a pending
    // approval or resurrecting a rejected one).
    const addSessionRequest = useCallback(
        (request: WalletConnectSessionRequest) => {
            const { sessionRequests, setSessionRequests: setRequests } =
                useWalletConnectStore.getState()
            // The bridge replays a topic's pending history on every sub
            // frame, so the same handshake can arrive more than once — a
            // duplicate must not queue a second approval sheet or refresh
            // the original's TTL stamp.
            const isDuplicate = sessionRequests.some(
                queued =>
                    queued.clientId === request.clientId &&
                    queued.handshakeId !== undefined &&
                    queued.handshakeId === request.handshakeId,
            )
            if (isDuplicate) return
            // One pending handshake per connector: a new session_request on
            // the same clientId abandons the previous one on the dApp side,
            // so the stale queued entry is unapprovable and gets replaced.
            setRequests([
                ...sessionRequests.filter(
                    queued => queued.clientId !== request.clientId,
                ),
                { ...request, createdAt: Date.now() },
            ])
        },
        [],
    )

    const removeSessionRequest = useCallback(
        (request: WalletConnectSessionRequest) => {
            const { sessionRequests, setSessionRequests: setRequests } =
                useWalletConnectStore.getState()
            setRequests(sessionRequests.filter(r => r !== request))
        },
        [],
    )

    return {
        sessionRequests,
        addSessionRequest,
        removeSessionRequest,
    }
}
