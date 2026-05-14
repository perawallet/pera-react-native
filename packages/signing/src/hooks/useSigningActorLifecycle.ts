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
import { useLocalKeyTransactionSigner } from './useLocalKeyTransactionSigner'
import { useArbitraryDataSigner } from './useArbitraryDataSigner'
import { useArc60Signer } from './useArc60Signer'
import { useMultisigTransportAdapters } from './useMultisigTransportAdapters'
import { buildHardwareSigningCallbacks } from './buildHardwareSigningCallbacks'
import { useSigningStore, useHardwareSigningStore } from '../store'
import { createSigningMachine } from '../machine/createSigningMachine'
import { signingMachine } from '../machine/signingMachine'
import { createTransportSelector } from '../pipeline/transports/getTransport'
import { getNextQueuedRequest } from '../pipeline/queue'
import { approvalGate } from '../pipeline/approvalGate'
import { isInteractiveSource } from '../pipeline/types'
import type { SigningMachineDeps } from '../machine/context'
import { type SignRequest } from '../models'
import { resolveSignerAddress } from '../utils/resolveSignerAddress'

// Process-wide registry of running signing-machine actors, keyed by
// request id. Hoisted to module scope (rather than per-hook `useRef`) so
// that simultaneously-mounted consumers of `useSigningActorLifecycle`
// share a single Map: only the first hook instance whose effect runs for
// a given request creates the actor, and all the others see the entry
// already exists and bail. Without this, every consumer would race and
// produce one parallel signing machine per mount.
const actorRefsMap = new Map<string, AnyActorRef>()

// Tracks which requests we've already started awaiting the approval gate
// for, so we don't re-enter `waitFor` on every snapshot tick while the
// machine sits in `awaiting_user`.
const awaitingApprovalSet = new Set<string>()

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
    awaitingApprovalSet.clear()
    approvalGate.__resetForTests()
}

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
 * Non-interactive callers (internal send/swap flows — anything whose
 * `sourceType` is not in `INTERACTIVE_SOURCES`) have no retry UI, so a
 * `failed` state is terminal for them regardless of the error's
 * retryable flag — otherwise the actor and request both leak, blocking
 * every subsequent request because the single-flight queue guard sees a
 * running actor.
 */
const isNonInteractiveFailure = (
    snapshot: SnapshotFrom<typeof signingMachine>,
): boolean => {
    if (!snapshot.matches('failed')) return false
    return !isInteractiveSource(snapshot.context.request.sourceType)
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
        (request: SignRequest): SigningMachineDeps => {
            // Resolve the signer account so the hardware-signing overlay
            // can render the device name from the very first phase signal.
            // For non-hardware signers, the callback builder degrades to a
            // null deviceName — the overlay never opens in that case
            // because only the hardware strategy emits phase callbacks.
            const signerAddress = resolveSignerAddress(request)
            const signerAccount = signerAddress
                ? allAccounts.find(acc => acc.address === signerAddress)
                : undefined

            return {
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
                // Drives the LedgerSigningContent sheet via useHardwareSigningStore.
                // Only the hardware strategy emits these callbacks, so requests
                // that resolve to local-key/multisig signers never touch the
                // sheet state.
                signingCallbacks: buildHardwareSigningCallbacks(
                    request,
                    signerAccount,
                ),
            }
        },
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
            allAccounts,
        ],
    )

    // Creates, subscribes to, and starts an actor for the given request.
    const createActorForRequest = useCallback(
        (request: SignRequest) => {
            if (actorRefsMap.has(request.id)) {
                return
            }

            // Register the approval gate synchronously here, before the
            // machine has a chance to reach `awaiting_user`. Co-locating
            // registration with actor creation (rather than driving it
            // from a sibling effect on `pendingSignRequests`) removes the
            // cross-effect ordering dependency: an interactive request
            // can never reach the pause state with no gate registered,
            // so it can never be silently auto-approved by the headless
            // fast-path. Headless sources skip registration entirely.
            if (isInteractiveSource(request.sourceType)) {
                approvalGate.register(request.id)
            }

            const actor = createSigningMachine(
                request,
                allAccounts,
                buildDeps(request),
            )

            actor.subscribe(snapshot => {
                // Bridge the machine's external sync point to the approval
                // gate. Headless flows resolve immediately (no gate was
                // registered when the actor was created), interactive
                // flows block on the gate until `signAndSendRequest` /
                // `rejectRequest` (slide / dismiss) resolves it.
                //
                // `'cancelled'` is emitted by `approvalGate.unregister` to
                // release this `.then` chain when the actor is torn down
                // for reasons unrelated to user input. The actor is on its
                // way to (or already at) a terminal state in that case, so
                // we just no-op.
                if (
                    snapshot.matches('awaiting_user') &&
                    !awaitingApprovalSet.has(actor.id)
                ) {
                    awaitingApprovalSet.add(actor.id)
                    void approvalGate.waitFor(actor.id).then(result => {
                        awaitingApprovalSet.delete(actor.id)
                        if (result === 'cancelled') return
                        actor.send({
                            type:
                                result === 'approved'
                                    ? 'USER_APPROVED'
                                    : 'USER_REJECTED',
                        })
                    })
                }

                const isTerminal =
                    snapshot.status === 'done' ||
                    isNonRetryableFailure(snapshot) ||
                    isNonInteractiveFailure(snapshot)

                if (!isTerminal) return

                const req = snapshot.context.request
                const isInteractive = isInteractiveSource(req.sourceType)
                // Interactive failures stay in the queue so the signing sheet
                // keeps rendering; the inline error view (driven by
                // lastFailedRequest in the store) takes over the sheet
                // content until the user dismisses via removeSignRequest.
                const keepForInlineError =
                    snapshot.matches('failed') && isInteractive

                // Tear down the hardware overlay on any terminal transition
                // for the matching request — success, rejection, or
                // non-retryable failure (the inline error sheet takes over).
                const hardwareStore = useHardwareSigningStore.getState()
                if (hardwareStore.requestId === req.id) {
                    hardwareStore.reset()
                }

                if (snapshot.matches('completed')) {
                    // Publish the transport result regardless of source.
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
                    // Headless callers own the completion UI; only the
                    // standard review flow (the `SigningOverlays` drivers)
                    // reads these store fields.
                    if (isInteractive) {
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
                    if (isInteractive) {
                        setLastFailedRequestRef.current({
                            request: req,
                            error: normalizedError,
                        })
                    }
                } else if (snapshot.matches('rejected')) {
                    ;(req as { reject?: () => Promise<void> }).reject?.()
                }

                // The lifecycle owns gate cleanup — `approve`/`reject` only
                // resolve, they don't delete (otherwise a Cancel tap during
                // the async validating phase would be lost). `unregister`
                // both resolves any still-pending deferred with `'cancelled'`
                // (releasing the awaiting `.then` closure) and removes the
                // map entry.
                approvalGate.unregister(actor.id)
                awaitingApprovalSet.delete(actor.id)

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
        approvalGate.unregister(requestId)
        awaitingApprovalSet.delete(requestId)
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
