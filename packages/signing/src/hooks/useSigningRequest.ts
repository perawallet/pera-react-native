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

import { useCallback } from 'react'
import type { AnyActorRef } from 'xstate'
import { useSigningStore } from '../store'
import { useSigningActorLifecycle } from './useSigningActorLifecycle'
import type { FailedSignRequest, SignRequest } from '../models'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    generateOrderedUniqueId,
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
    lastCompletedRequest: SignRequest | null
    lastFailedRequest: FailedSignRequest | null
    currentRequest: SignRequest | undefined
    currentActorRef: AnyActorRef | null
    addSignRequest: (request: SignRequest) => void
    removeSignRequest: (request: SignRequest) => void
    clearLastCompletedRequest: () => void
    clearLastFailedRequest: () => void
    signAndSendRequest: (request: SignRequest) => void
    rejectRequest: (request: SignRequest) => void
    /** Retries a failed request if its error is retryable. */
    retryRequest: (request: SignRequest) => void
}

// =============================================================================
// Hook
// =============================================================================

export const useSigningRequest = (): UseSigningRequestResult => {
    const pendingSignRequests = useSigningStore(
        state => state.pendingSignRequests,
    )
    const addSignRequestToStore = useSigningStore(state => state.addSignRequest)
    const removeSignRequestFromStore = useSigningStore(
        state => state.removeSignRequest,
    )
    const lastCompletedRequest = useSigningStore(
        state => state.lastCompletedRequest,
    )
    const setLastCompletedRequest = useSigningStore(
        state => state.setLastCompletedRequest,
    )
    const lastFailedRequest = useSigningStore(state => state.lastFailedRequest)
    const setLastFailedRequest = useSigningStore(
        state => state.setLastFailedRequest,
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

    const clearLastCompletedRequest = useCallback(() => {
        setLastCompletedRequest(null)
    }, [setLastCompletedRequest])

    const clearLastFailedRequest = useCallback(() => {
        setLastFailedRequest(null)
    }, [setLastFailedRequest])

    /**
     * Approves the current signing request — sends USER_APPROVED to its actor.
     * The actor handles signing and transport internally.
     */
    const signAndSendRequest = useCallback(
        (request: SignRequest) => {
            getActorRef(request.id)?.send({ type: 'USER_APPROVED' })
        },
        [getActorRef],
    )

    /**
     * Rejects the current signing request — sends USER_REJECTED to its actor.
     * For callback transport requests, also fires the reject callback.
     */
    const rejectRequest = useCallback(
        (request: SignRequest) => {
            const actor = getActorRef(request.id)
            if (actor) {
                actor.send({ type: 'USER_REJECTED' })
            } else {
                // Fallback: no actor found (shouldn't happen in normal flow)
                if (request.transport === 'callback') {
                    ;(request as { reject?: () => void }).reject?.()
                }
                removeSignRequestFromStore(request)
            }
        },
        [getActorRef, removeSignRequestFromStore],
    )

    /**
     * Retries a failed request — sends RETRY to its actor.
     * Only works if the error is retryable (transient network/signing failures).
     */
    const retryRequest = useCallback(
        (request: SignRequest) => {
            getActorRef(request.id)?.send({ type: 'RETRY' })
        },
        [getActorRef],
    )

    const currentRequest = pendingSignRequests?.at(0)
    const currentActorRef = currentRequest
        ? (getActorRef(currentRequest.id) ?? null)
        : null

    return {
        pendingSignRequests,
        lastCompletedRequest,
        lastFailedRequest,
        currentRequest,
        currentActorRef,
        addSignRequest,
        removeSignRequest,
        clearLastCompletedRequest,
        clearLastFailedRequest,
        signAndSendRequest,
        rejectRequest,
        retryRequest,
    }
}
