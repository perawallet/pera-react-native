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
    /** Map of request ID → running actor ref */
    getActorRef: (requestId: string) => AnyActorRef | undefined
    /** Creates, subscribes to, and starts an actor for the given request */
    startActor: (request: SignRequest) => void
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

    const startActor = useCallback(
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
                        ;(req as { error?: (msg: string) => void }).error?.(
                            error instanceof Error
                                ? error.message
                                : 'Signing failed',
                        )
                    }
                }

                actorRefsMap.current.delete(actor.id)
                removeSignRequestFromStoreRef.current(snapshot.context.request)
            })

            actor.start()
            actorRefsMap.current.set(request.id, actor)
        },
        [allAccounts, buildDeps],
    )

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

    // On mount, create actors for any requests that were rehydrated from storage
    const hasRehydrated = useRef(false)
    useEffect(() => {
        if (hasRehydrated.current) return
        hasRehydrated.current = true

        for (const request of pendingSignRequests) {
            if (!actorRefsMap.current.has(request.id)) {
                startActor(request)
            }
        }
    }, [])

    return { getActorRef, startActor, stopActor }
}
