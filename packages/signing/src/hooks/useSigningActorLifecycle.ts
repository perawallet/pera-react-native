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
import type { AnyActorRef, SnapshotFrom } from 'xstate'
import { AppError } from '@perawallet/wallet-core-shared'
import {
    useAlgorandClient,
    useTransactionEncoder,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useTransactionSigner } from './useTransactionSigner'
import { useSigningStore } from '../store'
import { createSigningMachine } from '../machine/createSigningMachine'
import { signingMachine } from '../machine/signingMachine'
import { createTransportSelector } from '../pipeline/transports/getTransport'
import { getNextQueuedRequest } from '../pipeline/queue'
import type { SigningMachineDeps } from '../machine/context'
import type { SignRequest } from '../models'

// =============================================================================
// Helpers
// =============================================================================

/** Checks if the machine is in `failed` with a non-retryable error (terminal). */
const isNonRetryableFailure = (
    snapshot: SnapshotFrom<typeof signingMachine>,
): boolean => {
    if (!snapshot.matches('failed')) return false
    const error = snapshot.context.error
    if (!error || !(error instanceof AppError)) return true
    return error.metadata.retryable !== true
}

// =============================================================================
// Types
// =============================================================================

type UseSigningActorLifecycleResult = {
    /** Returns the running actor ref for a request ID, if any */
    getActorRef: (requestId: string) => AnyActorRef | undefined
    /** Stops and removes the actor for the given request */
    stopActor: (requestId: string) => void
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Manages XState actor lifecycle: creation, subscription, cleanup.
 * Actor refs are stored in a ref (not Zustand) since they are ephemeral
 * and non-serializable.
 *
 * A reactive effect watches `pendingSignRequests` and starts the next
 * actor when the queue is empty. This handles rehydration, new requests,
 * and queue advancement after completion — all from a single mechanism.
 */
export const useSigningActorLifecycle = (): UseSigningActorLifecycleResult => {
    const pendingSignRequests = useSigningStore(
        state => state.pendingSignRequests,
    )
    const removeSignRequestFromStore = useSigningStore(
        state => state.removeSignRequest,
    )
    const setLastCompletedRequest = useSigningStore(
        state => state.setLastCompletedRequest,
    )

    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const allAccounts = useAllAccounts()

    // Actor refs stored in a Map ref — ephemeral, not persisted, no re-renders
    const actorRefsMap = useRef(new Map<string, AnyActorRef>())

    // Stable refs so the actor subscription callback never becomes stale
    const removeSignRequestFromStoreRef = useRef(removeSignRequestFromStore)
    const setLastCompletedRequestRef = useRef(setLastCompletedRequest)
    removeSignRequestFromStoreRef.current = removeSignRequestFromStore
    setLastCompletedRequestRef.current = setLastCompletedRequest

    const buildDeps = useCallback(
        (): SigningMachineDeps => ({
            signTransactions,
            createTransport: createTransportSelector({
                algokit,
                encodeSignedTransactions,
            }),
            network,
        }),
        [signTransactions, encodeSignedTransactions, algokit, network],
    )

    // Creates, subscribes to, and starts an actor for the given request.
    const createActorForRequest = useCallback(
        (request: SignRequest) => {
            if (actorRefsMap.current.has(request.id)) return

            const actor = createSigningMachine(
                request,
                allAccounts,
                buildDeps(),
            )

            actor.subscribe(snapshot => {
                const isTerminal =
                    snapshot.status === 'done' ||
                    isNonRetryableFailure(snapshot)

                if (!isTerminal) return

                if (snapshot.matches('completed')) {
                    setLastCompletedRequestRef.current(snapshot.context.request)
                } else if (snapshot.matches('failed')) {
                    const { request: req, error } = snapshot.context
                    if (req.transport === 'callback') {
                        ;(req as { error?: (err: Error) => void }).error?.(
                            error instanceof Error
                                ? error
                                : new Error('Signing failed'),
                        )
                    }
                }

                actorRefsMap.current.delete(actor.id)
                // Removing from the store triggers pendingSignRequests to change,
                // which fires the reactive effect below to start the next actor.
                removeSignRequestFromStoreRef.current(snapshot.context.request)
            })

            actor.start()
            actorRefsMap.current.set(request.id, actor)
        },
        [allAccounts, buildDeps],
    )

    // Ref so the effect always has the latest createActorForRequest
    const createActorRef = useRef(createActorForRequest)
    createActorRef.current = createActorForRequest

    const stopActor = useCallback((requestId: string) => {
        const actor = actorRefsMap.current.get(requestId)
        if (actor) {
            actor.stop()
            actorRefsMap.current.delete(requestId)
        }
    }, [])

    const getActorRef = useCallback((requestId: string) => {
        return actorRefsMap.current.get(requestId)
    }, [])

    // Reactive queue effect: starts the next actor whenever
    // pendingSignRequests changes and no actor is currently running.
    // Handles rehydration (mount), new requests, and queue advancement.
    useEffect(() => {
        const next = getNextQueuedRequest(
            pendingSignRequests,
            actorRefsMap.current.size,
        )
        if (next) {
            createActorRef.current(next)
        }
    }, [pendingSignRequests])

    return { getActorRef, stopActor }
}
