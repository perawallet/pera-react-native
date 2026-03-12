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

import { useCallback, useEffect, useRef } from 'react'
import type { AnyActorRef } from 'xstate'
import {
    useAlgorandClient,
    useTransactionEncoder,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useTransactionSigner } from './useTransactionSigner'
import { useSigningStore } from '../store'
import { createSigningMachine } from '../machine/createSigningMachine'
import type { SigningMachineDeps } from '../machine/context'
import type { SignRequest } from '../models'
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
// Hook
// =============================================================================

export const useSigningRequest = () => {
    const pendingSignRequests = useSigningStore(
        state => state.pendingSignRequests,
    )
    const actorRefs = useSigningStore(state => state.actorRefs)
    const addSignRequestToStore = useSigningStore(state => state.addSignRequest)
    const removeSignRequestFromStore = useSigningStore(
        state => state.removeSignRequest,
    )
    const addActorRef = useSigningStore(state => state.addActorRef)
    const removeActorRef = useSigningStore(state => state.removeActorRef)
    const lastCompletedRequest = useSigningStore(
        state => state.lastCompletedRequest,
    )
    const setLastCompletedRequest = useSigningStore(
        state => state.setLastCompletedRequest,
    )

    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const allAccounts = useAllAccounts()

    // Stable refs so the actor subscription callback never becomes stale
    const removeActorRefRef = useRef(removeActorRef)
    const removeSignRequestFromStoreRef = useRef(removeSignRequestFromStore)
    const setLastCompletedRequestRef = useRef(setLastCompletedRequest)
    removeActorRefRef.current = removeActorRef
    removeSignRequestFromStoreRef.current = removeSignRequestFromStore
    setLastCompletedRequestRef.current = setLastCompletedRequest

    const buildDeps = useCallback(
        (): SigningMachineDeps => ({
            signTransactions,
            encodeSignedTransactions,
            algokit,
            network,
            // Multisig transports are stubbed until Phase 9
            proposeSignRequest: async () => {
                throw new Error('Multisig signing not yet supported')
            },
            addSignatures: async () => {
                throw new Error('Multisig signing not yet supported')
            },
        }),
        [signTransactions, encodeSignedTransactions, algokit, network],
    )

    /**
     * Creates, subscribes to, and starts an actor for the given request.
     * Cleans up the store when the actor reaches a terminal state.
     */
    const createAndStartActor = useCallback(
        (request: SignRequest) => {
            const actor = createSigningMachine(
                request,
                allAccounts,
                buildDeps(),
            )

            actor.subscribe(snapshot => {
                if (snapshot.status !== 'done') return

                if (snapshot.matches('completed')) {
                    setLastCompletedRequestRef.current(snapshot.context.request)
                } else if (snapshot.matches('failed')) {
                    const { request: req, error } = snapshot.context
                    if (req.transport === 'callback') {
                        ;(req as { error?: (msg: string) => void }).error?.(
                            error instanceof Error
                                ? error.message
                                : 'Signing failed',
                        )
                    }
                }
                removeActorRefRef.current(actor.id)
                removeSignRequestFromStoreRef.current(snapshot.context.request)
            })

            actor.start()
            addActorRef(actor)
        },
        [allAccounts, buildDeps, addActorRef],
    )

    // On mount, create actors for any requests that were rehydrated from storage
    // (i.e. requests that survived an app restart and don't yet have a live actor)
    const hasRehydrated = useRef(false)
    useEffect(() => {
        if (hasRehydrated.current) return
        hasRehydrated.current = true

        const existingActorIds = new Set(
            actorRefs.map((ref: AnyActorRef) => ref.id),
        )
        for (const request of pendingSignRequests) {
            if (!existingActorIds.has(request.id)) {
                createAndStartActor(request)
            }
        }
    }, [])

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

            const added = addSignRequestToStore(newRequest)
            if (!added) return

            createAndStartActor(newRequest)
        },
        [addSignRequestToStore, createAndStartActor],
    )

    const removeSignRequest = useCallback(
        (request: SignRequest) => {
            const actor = actorRefs.find(
                (ref: AnyActorRef) => ref.id === request.id,
            )
            if (actor) {
                actor.stop()
                removeActorRef(actor.id)
            }
            removeSignRequestFromStore(request)
        },
        [actorRefs, removeActorRef, removeSignRequestFromStore],
    )

    const clearLastCompletedRequest = useCallback(() => {
        setLastCompletedRequest(null)
    }, [setLastCompletedRequest])

    /**
     * Approves the current signing request — sends USER_APPROVED to its actor.
     * The actor handles signing and transport internally.
     */
    const signAndSendRequest = useCallback(
        (request: SignRequest) => {
            const actor = actorRefs.find(
                (ref: AnyActorRef) => ref.id === request.id,
            )
            actor?.send({ type: 'USER_APPROVED' })
        },
        [actorRefs],
    )

    /**
     * Rejects the current signing request — sends USER_REJECTED to its actor.
     * For callback transport requests, also fires the reject callback.
     */
    const rejectRequest = useCallback(
        (request: SignRequest) => {
            const actor = actorRefs.find(
                (ref: AnyActorRef) => ref.id === request.id,
            )
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
        [actorRefs, removeSignRequestFromStore],
    )

    const currentRequest = pendingSignRequests?.at(0)
    const currentActorRef =
        actorRefs.find((ref: AnyActorRef) => ref.id === currentRequest?.id) ??
        null

    return {
        pendingSignRequests,
        lastCompletedRequest,
        currentRequest,
        currentActorRef,
        addSignRequest,
        removeSignRequest,
        clearLastCompletedRequest,
        signAndSendRequest,
        rejectRequest,
    }
}
