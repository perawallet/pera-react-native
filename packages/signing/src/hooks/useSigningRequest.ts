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

import { useCallback } from 'react'
import type { AnyActorRef } from 'xstate'
import { useSigningStore } from '../store'
import { useScopedSignRequestId } from './SigningRequestScope'
import { useSigningActorLifecycle } from './useSigningActorLifecycle'
import { approvalGate } from '../pipeline/approvalGate'
import type { SignRequest } from '../models'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    generateOrderedUniqueId,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    MAX_DATA_SIGN_REQUESTS,
    MAX_TRANSACTION_SIGN_REQUESTS,
} from '../constants'

// =============================================================================
// Types
// =============================================================================

type UseSigningRequestResult = {
    pendingSignRequests: SignRequest[]
    currentRequest: Optional<SignRequest>
    currentActorRef: Nullable<AnyActorRef>
    addSignRequest: (request: SignRequest) => void
    removeSignRequest: (request: SignRequest) => void
    signAndSendRequest: (request: SignRequest) => void
    rejectRequest: (request: SignRequest) => void
    /** Retries a failed request if its error is retryable. */
    retryRequest: (request: SignRequest) => void
}

// =============================================================================
// Hook
// =============================================================================

export const useSigningRequest = (): UseSigningRequestResult => {
    const scopedRequestId = useScopedSignRequestId()
    const pendingSignRequests = useSigningStore(
        state => state.pendingSignRequests,
    )
    const addSignRequestToStore = useSigningStore(state => state.addSignRequest)
    const removeSignRequestFromStore = useSigningStore(
        state => state.removeSignRequest,
    )

    const { getActorRef, stopActor } = useSigningActorLifecycle()

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    const addSignRequest = useCallback(
        (request: SignRequest) => {
            if (
                request.type === 'transactions' &&
                'txs' in request &&
                request.txs.flat().length > MAX_TRANSACTION_SIGN_REQUESTS
            ) {
                throw new AppError('Maximum number of transactions exceeded.', {
                    severity: ErrorSeverity.MEDIUM,
                    category: ErrorCategory.VALIDATION,
                    recoverable: false,
                    params: {
                        count: request.txs.length,
                        max: MAX_TRANSACTION_SIGN_REQUESTS,
                    },
                })
            }

            if (
                request.type === 'arbitrary-data' &&
                'data' in request &&
                request.data.length > MAX_DATA_SIGN_REQUESTS
            ) {
                throw new AppError('Maximum number of data exceeded.', {
                    severity: ErrorSeverity.MEDIUM,
                    category: ErrorCategory.VALIDATION,
                    recoverable: false,
                    params: {
                        count: request.data.length,
                        max: MAX_DATA_SIGN_REQUESTS,
                    },
                })
            }

            const newRequest: SignRequest = {
                ...request,
                id: request.id ?? generateOrderedUniqueId(),
            }

            addSignRequestToStore(newRequest)
        },
        [addSignRequestToStore],
    )

    const removeSignRequest = useCallback(
        (request: SignRequest) => {
            stopActor(request.id)
            removeSignRequestFromStore(request)
        },
        [stopActor, removeSignRequestFromStore],
    )

    /**
     * Approves the current signing request by resolving its approval gate.
     * The lifecycle hook picks up the resolution and sends USER_APPROVED
     * to the actor; the actor handles signing and transport internally.
     *
     * For headless requests (no gate registered), this is a no-op — the
     * lifecycle auto-resumes them as soon as the machine pauses.
     */
    const signAndSendRequest = useCallback((request: SignRequest) => {
        approvalGate.approve(request.id)
    }, [])

    /**
     * Rejects the current signing request by resolving its approval gate
     * with `'rejected'`. The lifecycle sends USER_REJECTED to the actor,
     * which transitions to `rejected` and fires the request's `reject`
     * callback via the standard terminal handler.
     *
     * Fallback path (no actor — shouldn't happen in normal flow): fires
     * the callback directly and drops the request from the queue.
     */
    const rejectRequest = useCallback(
        (request: SignRequest) => {
            const actor = getActorRef(request.id)
            if (actor) {
                // Both `failed` and `signing.hardware` sit *past* the approval
                // gate: the gate was already resolved when the user approved,
                // so `approvalGate.reject` would be a no-op (a resolved deferred
                // can't re-resolve) and the cancel tap would be silently
                // dropped. Send USER_REJECTED straight to the actor instead —
                // `failed` transitions to `rejected`, and `signing.hardware`
                // forwards it to the hardware child as USER_REJECTED_ON_DEVICE.
                // Mirrors how `next()` sends RETRY directly to a failed actor.
                const snapshot = actor.getSnapshot()
                if (
                    snapshot.matches('failed') ||
                    snapshot.matches({ signing: 'hardware' })
                ) {
                    actor.send({ type: 'USER_REJECTED' })
                    return
                }
                approvalGate.reject(request.id)
                return
            }
            if (request.transport === 'callback') {
                ;(request as { reject?: () => void }).reject?.()
            }
            removeSignRequestFromStore(request)
        },
        [getActorRef, removeSignRequestFromStore],
    )

    /**
     * Retries a failed request — sends RETRY to its actor.
     * Only works if the error is retryable (transient network/signing failures).
     */
    const retryRequest = useCallback(
        (request: SignRequest) => {
            const actor = getActorRef(request.id)
            actor?.send({ type: 'RETRY' })
        },
        [getActorRef],
    )

    // Inside a SigningRequestScopeProvider (the review sheet), bind to the
    // request the sheet was opened for; otherwise keep queue-head semantics
    // for headless flows. A scoped request that already left the queue
    // resolves to undefined, which reads as "nothing to act on".
    const currentRequest = scopedRequestId
        ? pendingSignRequests.find(r => r.id === scopedRequestId)
        : pendingSignRequests?.at(0)
    const currentActorRef = currentRequest
        ? (getActorRef(currentRequest.id) ?? null)
        : null

    return {
        pendingSignRequests,
        currentRequest,
        currentActorRef,
        addSignRequest,
        removeSignRequest,
        signAndSendRequest,
        rejectRequest,
        retryRequest,
    }
}
