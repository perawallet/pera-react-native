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

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
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
import { useQuantumTransactionSigner } from './useQuantumTransactionSigner'
import { useArbitraryDataSigner } from './useArbitraryDataSigner'
import { useLocalKeyArc60Signer } from './useLocalKeyArc60Signer'
import { useMultisigTransportAdapters } from './useMultisigTransportAdapters'
import { useSigningStore } from '../store'
import { createSigningMachine } from '../machine/createSigningMachine'
import { type signingMachine } from '../machine/signingMachine'
import { recordAppStateChange } from '../machine/children/appStateTracker'
import { createTransportSelector } from '../pipeline/transports/getTransport'
import { getNextQueuedRequest } from '../pipeline/queue'
import { approvalGate } from '../pipeline/approvalGate'
import { signingEventBus } from '../pipeline/signingEventBus'
import { isInteractiveSource } from '../pipeline/types'
import type { SigningMachineDeps } from '../machine/context'
import { type SignRequest } from '../models'

// Process-wide registry of running signing-machine actors, keyed by
// request id. Hoisted to module scope (rather than per-hook `useRef`) so
// that simultaneously-mounted consumers of `useSigningActorLifecycle`
// share a single Map: only the first hook instance whose effect runs for
// a given request creates the actor, and all the others see the entry
// already exists and bail. Without this, every consumer would race and
// produce one parallel signing machine per mount.
const actorRefsMap = new Map<string, AnyActorRef>()

// Tiny pub-sub layered over the registry so React components can subscribe
// via useSyncExternalStore and re-render when actors are added/removed. A
// bare module Map isn't reactive — without this, hooks that read
// `getActorRef(id)` during render would not pick up an actor that was
// created in the SAME render cycle (lifecycle's queue effect adds it after
// render completes), so subscribers like useSigningPipeline would forever
// see `currentActorRef === null` for the very first request.
let actorRegistryVersion = 0
const actorRegistryListeners = new Set<() => void>()
const subscribeActorRegistry = (listener: () => void): (() => void) => {
    actorRegistryListeners.add(listener)
    return () => actorRegistryListeners.delete(listener)
}
const notifyActorRegistry = (): void => {
    actorRegistryVersion += 1
    for (const listener of actorRegistryListeners) listener()
}
const getActorRegistryVersion = (): number => actorRegistryVersion

// Tracks which requests we've already started awaiting the approval gate
// for, so we don't re-enter `waitFor` on every snapshot tick while the
// machine sits in `awaiting_user`.
const awaitingApprovalSet = new Set<string>()

/**
 * Applies the backgrounding policy (PERA-4637) to every running hardware
 * signing session: past the grace window the session is aborted into the
 * retryable `interrupted` state (the exchange's AbortController reaches
 * the BLE layer when the invoked actor stops); within it, the substate
 * backstop timers are re-armed so a timer that expired while suspended
 * can't fire stale on resume.
 *
 * Exported (not a hook, no `react-native` import) so the app layer owns the
 * `AppState` subscription and feeds this in — keeping the signing logic
 * package free of react-native, which would otherwise force every dependent
 * (swaps, transactions, walletconnect, …) to parse react-native in its tests.
 * Operates on the module-global `actorRefsMap`, so a single app-level
 * subscription reaches whatever sessions are running.
 */
export const applyAppStateToHardwareSessions = (nextState: string): void => {
    const action = recordAppStateChange(nextState, Date.now())
    if (action === 'none') return
    for (const parent of actorRefsMap.values()) {
        const child = (
            parent.getSnapshot() as {
                children?: Record<string, AnyActorRef | undefined>
            }
        ).children?.hardwareChild
        if (!child) continue
        child.send({
            type:
                action === 'interrupt'
                    ? 'INTERRUPTED_BY_BACKGROUND'
                    : 'REARM_TIMERS',
        })
    }
}

// Dedupe sets for bus publishes that should fire at most once per actor.
const startedSet = new Set<string>()
const signingStartedSet = new Set<string>()

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
    notifyActorRegistry()
    awaitingApprovalSet.clear()
    startedSet.clear()
    signingStartedSet.clear()
    approvalGate.__resetForTests()
    signingEventBus.__resetForTests()
}

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

type UseSigningActorLifecycleResult = {
    /** Returns the running actor ref for a request ID, if any */
    getActorRef: (requestId: string) => Optional<AnyActorRef>
    /** Stops and removes the actor for the given request */
    stopActor: (requestId: string) => void
}

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

    const { signTransactions } = useLocalKeyTransactionSigner()
    const { signQuantumTransactions } = useQuantumTransactionSigner()
    const { signArbitraryData } = useArbitraryDataSigner()
    const { signArc60 } = useLocalKeyArc60Signer()
    const { encodeTransactionRaw, encodeSignedTransactions } =
        useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const allAccounts = useAllAccounts()
    const {
        proposeSignRequest,
        addSignatures,
        getMsigMetadata,
        getDeviceId,
        createDraftSignRequest,
    } = useMultisigTransportAdapters()

    // Stable ref so the actor subscription callback never becomes stale
    const removeSignRequestFromStoreRef = useRef(removeSignRequestFromStore)
    removeSignRequestFromStoreRef.current = removeSignRequestFromStore

    const buildDeps = useCallback(
        (_request: SignRequest): SigningMachineDeps => {
            return {
                signTransactions,
                signQuantumTransactions,
                signArbitraryData,
                signArc60,
                createTransport: createTransportSelector({
                    algokit,
                    encodeSignedTransactions,
                    network,
                    proposeSignRequest,
                    addSignatures,
                    getMsigMetadata,
                    getDeviceId,
                    createDraftSignRequest,
                }),
                network,
                // Hardware-wallet actor consumes this. Ledger adds the "TX"
                // domain-separation prefix on-device, so we pass raw msgpack.
                encodeTransaction: encodeTransactionRaw,
                hardwareWalletRegistry: getProvider().hardwareWalletRegistry,
            }
        },
        [
            signTransactions,
            signQuantumTransactions,
            signArbitraryData,
            signArc60,
            encodeTransactionRaw,
            encodeSignedTransactions,
            network,
            proposeSignRequest,
            addSignatures,
            getMsigMetadata,
            getDeviceId,
            createDraftSignRequest,
            algokit,
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
                // Publish lifecycle events (dedupe per actor where the
                // state may be revisited). These run BEFORE the approval
                // gate / terminal handlers so the bus reflects the same
                // ordering store consumers observe today.
                if (
                    snapshot.matches('validating') &&
                    !startedSet.has(actor.id)
                ) {
                    startedSet.add(actor.id)
                    signingEventBus.publish({
                        type: 'started',
                        request: snapshot.context.request,
                    })
                }

                // awaiting_user — published on each entry (also drives the
                // approval gate below, which has its own dedupe).
                if (snapshot.matches('awaiting_user')) {
                    signingEventBus.publish({
                        type: 'awaiting-user',
                        request: snapshot.context.request,
                    })
                }

                // signing-started — published once per signer type the
                // dispatch picks. Nested-state matcher is the XState v5
                // object form: { signing: 'localKey' } etc.
                const signingValue = snapshot.value as
                    | { signing?: string }
                    | string
                    | undefined
                const signingChild =
                    typeof signingValue === 'object' &&
                    signingValue &&
                    'signing' in signingValue
                        ? signingValue.signing
                        : undefined
                if (
                    signingChild === 'localKey' ||
                    signingChild === 'quantum' ||
                    signingChild === 'hardware' ||
                    signingChild === 'multisig'
                ) {
                    const key = `${actor.id}:${signingChild}`
                    if (!signingStartedSet.has(key)) {
                        signingStartedSet.add(key)
                        signingEventBus.publish({
                            type: 'signing-started',
                            request: snapshot.context.request,
                            signerType: signingChild,
                        })
                    }
                }

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
                // keeps rendering; the inline error view (driven by the
                // signing event bus via useSigningEvent / useLastSigningEvent)
                // takes over the sheet content until the user dismisses via
                // removeSignRequest.
                const keepForInlineError =
                    snapshot.matches('failed') && isInteractive

                if (snapshot.matches('completed')) {
                    // Publish the transport result regardless of source.
                    // Headless flows that don't surface completion UI still
                    // need a reliable hook for bus-driven listeners (e.g.
                    // PendingSignatures auto-open, send-funds exit on
                    // multisig propose). The `useSigningPipeline({ onEvent })`
                    // path is unreliable here because the lifecycle's actor
                    // lives in a non-reactive Map.
                    const { transportResult } = snapshot.context
                    if (transportResult) {
                        signingEventBus.publish({
                            type: 'transport-result',
                            request: req,
                            result: transportResult,
                        })
                        signingEventBus.publish({
                            type: 'completed',
                            request: req,
                            result: transportResult,
                        })
                    }
                    // The transport is responsible for invoking the request's
                    // approve callback (with the actual signed data) — see
                    // createCallbackTransport / createWalletConnectTransport.
                } else if (snapshot.matches('failed')) {
                    const { error } = snapshot.context
                    const normalizedError =
                        error instanceof Error
                            ? error
                            : new Error('Signing failed')
                    signingEventBus.publish({
                        type: 'failed',
                        request: req,
                        error: normalizedError,
                    })
                    ;(req as { error?: (err: Error) => void }).error?.(
                        normalizedError,
                    )
                } else if (snapshot.matches('rejected')) {
                    signingEventBus.publish({
                        type: 'rejected',
                        request: req,
                    })
                    void (req as { reject?: () => Promise<void> }).reject?.()
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
                notifyActorRegistry()
                signingEventBus.releaseRequest(actor.id)
                // Removing from the store triggers pendingSignRequests to change,
                // which fires the reactive effect below to start the next actor.
                removeSignRequestFromStoreRef.current(req)
            })

            actor.start()
            actorRefsMap.set(request.id, actor)
            notifyActorRegistry()
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
            notifyActorRegistry()
        }
        approvalGate.unregister(requestId)
        awaitingApprovalSet.delete(requestId)
        signingEventBus.releaseRequest(requestId)
    }, [])

    // Subscribe to registry changes so consumers (via getActorRef) re-render
    // when the actor for the current request is created or torn down. Without
    // this, hooks calling getActorRef during render would see the actor as
    // null forever after the queue-effect-driven create — there'd be no
    // re-render to pick the new entry up.
    useSyncExternalStore(
        subscribeActorRegistry,
        getActorRegistryVersion,
        getActorRegistryVersion,
    )

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
