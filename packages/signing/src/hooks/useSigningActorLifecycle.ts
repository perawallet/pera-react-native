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
import { AppError, type Optional } from '@perawallet/wallet-core-shared'
import {
    useAlgorandClient,
    useTransactionEncoder,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    LedgerConnectionError,
    LedgerTimeoutError,
} from '@perawallet/wallet-core-ledger'
import { useLocalKeyTransactionSigner } from './useLocalKeyTransactionSigner'
import { useArbitraryDataSigner } from './useArbitraryDataSigner'
import { useArc60Signer } from './useArc60Signer'
import { useMultisigTransportAdapters } from './useMultisigTransportAdapters'
import { useSigningStore, useHardwareSigningStore } from '../store'
import { createSigningMachine } from '../machine/createSigningMachine'
import { signingMachine } from '../machine/signingMachine'
import { createTransportSelector } from '../pipeline/transports/getTransport'
import { getNextQueuedRequest } from '../pipeline/queue'
import type { SigningMachineDeps } from '../machine/context'
import type { SigningCallbacks } from '../pipeline/types'
import type { SignRequest } from '../models'

// Process-wide registry of running signing-machine actors, keyed by
// request id. Hoisted to module scope (rather than per-hook `useRef`) so
// that simultaneously-mounted consumers of `useSigningActorLifecycle`
// share a single Map: only the first hook instance whose effect runs for
// a given request creates the actor, and all the others see the entry
// already exists and bail. Without this, every consumer would race and
// produce one parallel signing machine per mount.
const actorRefsMap = new Map<string, AnyActorRef>()

/**
 * Test-only: stops every running actor and clears the module-level
 * registry. Call from `beforeEach` so leftover actors from one test never
 * leak into the next.
 */
export const __resetSigningActorRegistryForTests = (): void => {
    for (const actor of actorRefsMap.values()) {
        actor.stop()
    }
    actorRefsMap.clear()
}

const isTimeoutError = (error: Error): boolean =>
    error instanceof LedgerTimeoutError ||
    (error instanceof LedgerConnectionError && /timed out/.test(error.message))

/**
 * Build SigningCallbacks that drive the hardware-signing UI store.
 * Bound to a specific request id so the overlay knows which actor to talk
 * to when the user presses cancel/retry.
 */
const buildHardwareSigningCallbacks = (
    requestId: string,
): SigningCallbacks => ({
    onPhaseChange: phase => {
        const store = useHardwareSigningStore.getState()
        if (phase === 'connecting') {
            store.start(requestId)
        } else if (phase === 'awaiting-approval') {
            store.setStatus('confirming')
        }
    },
    onProgress: (current, total) => {
        useHardwareSigningStore.getState().setProgress(current, total)
    },
    onError: error => {
        useHardwareSigningStore
            .getState()
            .setError(isTimeoutError(error) ? 'timeout' : 'error')
    },
})

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

/**
 * Headless callers (e.g. internal send/swap flows) have no retry UI, so a
 * `failed` state is terminal for them regardless of the error's retryable
 * flag — otherwise the actor and request both leak, blocking every
 * subsequent request because the single-flight queue guard sees a running
 * actor.
 */
const isHeadlessFailure = (
    snapshot: SnapshotFrom<typeof signingMachine>,
): boolean => {
    if (!snapshot.matches('failed')) return false
    return snapshot.context.request.headless === true
}

// =============================================================================
// Types
// =============================================================================

type UseSigningActorLifecycleResult = {
    /** Returns the running actor ref for a request ID, if any */
    getActorRef: (requestId: string) => Optional<AnyActorRef>
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
    const setLastFailedRequest = useSigningStore(
        state => state.setLastFailedRequest,
    )
    const setLastTransportResult = useSigningStore(
        state => state.setLastTransportResult,
    )

    const { signTransactions } = useLocalKeyTransactionSigner()
    const { signArbitraryData } = useArbitraryDataSigner()
    const { signArc60 } = useArc60Signer()
    const { encodeTransactionRaw, encodeSignedTransactions } =
        useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const allAccounts = useAllAccounts()
    const { proposeSignRequest, addSignatures } = useMultisigTransportAdapters()

    // Stable refs so the actor subscription callback never becomes stale
    const removeSignRequestFromStoreRef = useRef(removeSignRequestFromStore)
    const setLastCompletedRequestRef = useRef(setLastCompletedRequest)
    const setLastFailedRequestRef = useRef(setLastFailedRequest)
    const setLastTransportResultRef = useRef(setLastTransportResult)
    removeSignRequestFromStoreRef.current = removeSignRequestFromStore
    setLastCompletedRequestRef.current = setLastCompletedRequest
    setLastFailedRequestRef.current = setLastFailedRequest
    setLastTransportResultRef.current = setLastTransportResult

    const buildDeps = useCallback(
        (request: SignRequest): SigningMachineDeps => ({
            signTransactions,
            signArbitraryData,
            signArc60,
            createTransport: createTransportSelector({
                algokit,
                encodeSignedTransactions,
                network,
                proposeSignRequest,
                addSignatures,
            }),
            network,
            // Hardware-wallet actor consumes this. Ledger adds the "TX"
            // domain-separation prefix on-device, so we pass raw msgpack.
            encodeTransaction: encodeTransactionRaw,
            hardwareWalletRegistry: getProvider().hardwareWalletRegistry,
            // Drives the LedgerSigningOverlay via useHardwareSigningStore.
            // Only the hardware strategy emits these callbacks, so requests
            // that resolve to local-key/multisig signers never touch the
            // overlay state.
            signingCallbacks: buildHardwareSigningCallbacks(request.id),
        }),
        [
            signTransactions,
            signArbitraryData,
            signArc60,
            encodeTransactionRaw,
            encodeSignedTransactions,
            algokit,
            network,
            proposeSignRequest,
            addSignatures,
        ],
    )

    // Creates, subscribes to, and starts an actor for the given request.
    const createActorForRequest = useCallback(
        (request: SignRequest) => {
            if (actorRefsMap.has(request.id)) {
                return
            }

            const actor = createSigningMachine(
                request,
                allAccounts,
                buildDeps(request),
            )

            actor.subscribe(snapshot => {
                const isTerminal =
                    snapshot.status === 'done' ||
                    isNonRetryableFailure(snapshot) ||
                    isHeadlessFailure(snapshot)

                if (!isTerminal) return

                const req = snapshot.context.request
                // Non-headless failures stay in the queue so the signing sheet
                // keeps rendering; the inline error view (driven by
                // lastFailedRequest in the store) takes over the sheet
                // content until the user dismisses via removeSignRequest.
                const keepForInlineError =
                    snapshot.matches('failed') && !req.headless

                // Tear down the hardware overlay on any terminal transition
                // for the matching request — success, rejection, or
                // non-retryable failure (the inline error sheet takes over).
                const hardwareStore = useHardwareSigningStore.getState()
                if (hardwareStore.requestId === req.id) {
                    hardwareStore.reset()
                }

                if (snapshot.matches('completed')) {
                    // Publish the transport result regardless of `headless`.
                    // Headless flows that don't surface completion UI still
                    // need a reliable hook for store-driven listeners (e.g.
                    // PendingSignatures auto-open, send-funds exit on
                    // multisig propose). The `useSigningPipeline({ onEvent })`
                    // path is unreliable here because the lifecycle's actor
                    // lives in a non-reactive Map.
                    const { transportResult } = snapshot.context
                    if (transportResult) {
                        setLastTransportResultRef.current(transportResult)
                    }
                    // The transport is responsible for invoking the request's
                    // approve callback (with the actual signed data) — see
                    // createCallbackTransport / createWalletConnectTransport.
                    // Headless callers own the completion UI, same as the
                    // pre-sign review UI (see SignRequest.headless).
                    if (!req.headless) {
                        setLastCompletedRequestRef.current(req)
                    }
                } else if (snapshot.matches('failed')) {
                    const { error } = snapshot.context
                    const normalizedError =
                        error instanceof Error
                            ? error
                            : new Error('Signing failed')
                    ;(req as { error?: (err: Error) => void }).error?.(
                        normalizedError,
                    )
                    // Publish failure to the store so signing UIs can render
                    // an inline error view. Actor refs live in per-instance
                    // maps (not shared state), so the store is the only
                    // mechanism that reliably re-renders all subscribers.
                    // Headless callers drive their own error UI.
                    if (!req.headless) {
                        setLastFailedRequestRef.current({
                            request: req,
                            error: normalizedError,
                        })
                    }
                } else if (snapshot.matches('rejected')) {
                    ;(req as { reject?: () => Promise<void> }).reject?.()
                }

                if (keepForInlineError) return

                actorRefsMap.delete(actor.id)
                // Removing from the store triggers pendingSignRequests to change,
                // which fires the reactive effect below to start the next actor.
                removeSignRequestFromStoreRef.current(req)
            })

            actor.start()
            actorRefsMap.set(request.id, actor)
        },
        [allAccounts, buildDeps],
    )

    // Ref so the effect always has the latest createActorForRequest
    const createActorRef = useRef(createActorForRequest)
    createActorRef.current = createActorForRequest

    const stopActor = useCallback((requestId: string) => {
        const actor = actorRefsMap.get(requestId)
        if (actor) {
            actor.stop()
            actorRefsMap.delete(requestId)
        }
    }, [])

    const getActorRef = useCallback((requestId: string) => {
        return actorRefsMap.get(requestId)
    }, [])

    // Reactive queue effect: starts the next actor whenever
    // pendingSignRequests changes and no actor is currently running.
    // Handles rehydration (mount), new requests, and queue advancement.
    useEffect(() => {
        const next = getNextQueuedRequest(
            pendingSignRequests,
            actorRefsMap.size,
        )
        if (next) {
            createActorRef.current(next)
        }
    }, [pendingSignRequests])

    return { getActorRef, stopActor }
}
