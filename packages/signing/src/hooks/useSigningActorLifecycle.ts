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
import {
    isHardwareWalletAccount,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'
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
import {
    isArbitraryDataRequest,
    isArc60Request,
    isTransactionRequest,
    type SignRequest,
} from '../models'
import { classifyLedgerErrorKind } from '../utils/classifyLedgerErrorKind'

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

/**
 * Resolve the primary signer address for a sign request so the lifecycle
 * can look up the corresponding {@link WalletAccount} (we need this to
 * thread the device name into the hardware-signing overlay).
 *
 * Mirrors the per-request-type signer extraction in `buildSignableGroups`
 * (see `machine/actions.ts`); kept local + minimal because the overlay
 * only needs *a* signer (the device name is identical across groups for a
 * given hardware request).
 */
export const resolveSignerAddress = (
    request: SignRequest,
): string | undefined => {
    if (isTransactionRequest(request)) {
        const firstTx = request.txs[0]
        if (!firstTx) return undefined
        const override = request.signerOverrides?.get(0)
        if (override) return override
        // Defensive: malformed/mocked tx shapes (e.g. test fixtures) may
        // not carry a sender. The hardware overlay can still open without
        // a known signer — deviceName just falls back to null.
        return firstTx.sender?.toString?.()
    }
    if (isArbitraryDataRequest(request)) {
        return request.data[0]?.signer
    }
    if (isArc60Request(request)) {
        return request.stdSigData?.signer
    }
    return undefined
}

/**
 * Build SigningCallbacks that drive the hardware-signing UI store.
 *
 * Translates strategy-emitted phase signals (connecting / awaiting-approval),
 * signing-start, progress, and error events into the store-level actions
 * that back the LedgerSigningContent sheet. The error path uses
 * {@link classifyLedgerErrorKind} so the overlay can render preset-specific
 * copy without a UI-layer dependency reaching into the signing package.
 *
 * The signer account is taken at callback-build time (not lazily) so the
 * overlay can show the device name from the very first `onPhaseChange`.
 *
 * Exported so callback-level behavior can be unit-tested in isolation —
 * see `buildHardwareSigningCallbacks.spec.ts`.
 */
export const buildHardwareSigningCallbacks = (
    request: SignRequest,
    signerAccount: WalletAccount | undefined,
): SigningCallbacks => {
    const deviceName =
        signerAccount && isHardwareWalletAccount(signerAccount)
            ? signerAccount.hardwareDetails.deviceName
            : null

    return {
        onPhaseChange: phase => {
            const store = useHardwareSigningStore.getState()
            if (phase === 'connecting') {
                store.start(request.id, deviceName)
            } else if (phase === 'awaiting-approval') {
                store.setStatus('awaitingApproval')
            }
        },
        onSigningStart: () => {
            useHardwareSigningStore.getState().setStatus('signing')
        },
        onProgress: (current, total) => {
            // Update progress counters only. Status transitions are driven by
            // onPhaseChange (which createHardwareStrategy emits before each
            // signTransaction call) — decoupling progress from status means
            // skipped indices never incorrectly flip the overlay to
            // 'awaitingApproval', and the 'signing' state set by onSigningStart
            // remains observable until the first onPhaseChange fires.
            useHardwareSigningStore.getState().setProgress(current, total)
        },
        onError: error => {
            const kind = classifyLedgerErrorKind(error)
            useHardwareSigningStore.getState().setError({ kind, cause: error })
        },
    }
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
