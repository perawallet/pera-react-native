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

// Module scope, not a per-hook `useRef`, so every mounted consumer shares one
// Map: the first effect to run for a request creates the actor and the rest
// bail. Otherwise each mount would race and spawn its own signing machine.
const actorRefsMap = new Map<string, AnyActorRef>()

// A bare module Map isn't reactive, so this pub-sub lets components subscribe
// via useSyncExternalStore. Without it, an actor created after render (by the
// queue effect) is never picked up, and the first request's subscribers see
// `currentActorRef === null` forever.
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
 * Backgrounding policy for running hardware sessions: past the grace window,
 * abort into the retryable `interrupted` state; within it, re-arm the substate
 * timers so one that expired while suspended can't fire stale on resume.
 *
 * A plain export rather than a hook so the app layer owns the `AppState`
 * subscription — keeping react-native out of this package, which would
 * otherwise force every dependent to parse it in tests.
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

/** Test-only. Call from `beforeEach` so actors never leak between tests. */
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
 * Non-interactive callers have no retry UI, so `failed` is terminal for them
 * whatever the retryable flag says — otherwise the actor and request leak and
 * the single-flight queue guard blocks everything after them.
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
 * Actor refs live in a ref rather than Zustand — they're ephemeral and
 * non-serializable. One effect watching `pendingSignRequests` covers
 * rehydration, new requests and queue advancement alike.
 */
export const useSigningActorLifecycle = (): UseSigningActorLifecycleResult => {
    const pendingSignRequests = useSigningStore(
        state => state.pendingSignRequests,
    )
    const removeSignRequestFromStore = useSigningStore(
        state => state.removeSignRequest,
    )

    const { signTransactions } = useLocalKeyTransactionSigner()
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

            // Synchronous, and co-located with actor creation rather than in a
            // sibling effect, so there's no ordering dependency: an interactive
            // request can never reach `awaiting_user` ungated and be silently
            // auto-approved by the headless fast-path.
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

                // Headless flows resolve immediately (no gate was registered);
                // interactive ones block until the slide or dismiss resolves it.
                //
                // `'cancelled'` comes from `approvalGate.unregister` to release
                // this chain when the actor is torn down for reasons unrelated
                // to user input — it's already heading to a terminal state.
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
                // Interactive failures stay queued so the sheet keeps rendering
                // and the inline error view takes over until the user
                // dismisses.
                const keepForInlineError =
                    snapshot.matches('failed') && isInteractive

                if (snapshot.matches('completed')) {
                    // Published regardless of source: headless flows still need
                    // a reliable hook for bus-driven listeners, and
                    // `useSigningPipeline({ onEvent })` is unreliable here
                    // because the actor lives in a non-reactive Map.
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

                // The lifecycle owns gate cleanup: `approve`/`reject` only
                // resolve, never delete, or a Cancel tap during the async
                // validating phase would be lost.
                approvalGate.unregister(actor.id)
                awaitingApprovalSet.delete(actor.id)

                if (keepForInlineError) return

                // `completed`/`rejected` are final states, so XState stops the
                // actor (and tears down this subscription) on its own. `failed`
                // is not final — it stays live for RETRY — so a terminal failure
                // reaching here must be stopped explicitly, or the actor is
                // orphaned: removed from the map below, unreachable by stopActor,
                // its subscription never completed. stop() is idempotent, so
                // it's a safe no-op for the already-done paths.
                actor.stop()

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

    // Without this, a hook calling getActorRef during render would see null
    // forever after the queue effect creates the actor — nothing would trigger
    // the re-render that picks it up.
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
