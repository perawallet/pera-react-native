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

import type { Network } from '@perawallet/wallet-core-shared'
import type { SourceCallbacks, SourceMetadata } from './types'

/**
 * In-flight WalletConnect (or webview / deeplink) sync-flow handoff. Stashed
 * by the multisig-propose transport at the moment the backend record is
 * created, so a later "threshold met" event can pick up the callbacks and
 * deliver the assembled signed bytes to the dApp.
 *
 * The registry is process-wide (module-level Map) because the propose
 * transport runs inside the signing pipeline (no React tree) and the
 * resolver hook runs at the app root — they need a shared identity that
 * survives React re-renders without going through Zustand (these entries
 * hold non-serializable function references).
 *
 * Pattern mirrors {@link ./approvalGate.ts}.
 */
export type PendingWalletConnectHandoff = {
    signRequestId: string
    /** Multisig account address. */
    multisigAddress: string
    /** Multisig metadata required to build the `msig` field. */
    msigMetadata: {
        version: number
        threshold: number
        addresses: string[]
    }
    /** Device id for the `with-signatures` + `mark-confirmed` calls. */
    deviceId: string
    /**
     * Network the sign-request was created on. Captured here so the
     * resolver keeps polling the right backend even if the user switches
     * networks mid-flight.
     */
    network: Network
    /**
     * The WC source callbacks. `approveSignedBytes` delivers the
     * assembled signed bytes (pre-encoded msgpack, original txn embedded
     * verbatim so participant signatures verify on algod).
     * `error` for terminal failures, `softReject` for participant
     * decline / expired without a connection-error banner.
     */
    callbacks: Pick<
        SourceCallbacks,
        'approveSignedBytes' | 'error' | 'softReject'
    >
    /** Forwarded source metadata, useful for logging / dedup. */
    source: SourceMetadata
    /** Timestamp of registration; for diagnostics. */
    registeredAt: number
}

const handoffs = new Map<string, PendingWalletConnectHandoff>()
const subscribers = new Set<() => void>()
let version = 0

const notify = (): void => {
    version++
    // Iterate over a copy so a subscriber unsubscribing during invocation
    // doesn't interfere with the iteration order.
    for (const cb of [...subscribers]) {
        try {
            cb()
        } catch {
            // Subscriber failures are non-fatal — log via the host's
            // error reporter if needed. Keeping this stateless here so the
            // signing pkg doesn't pull in app-level logging.
        }
    }
}

const register = (handoff: PendingWalletConnectHandoff): void => {
    handoffs.set(handoff.signRequestId, handoff)
    notify()
}

const get = (signRequestId: string): PendingWalletConnectHandoff | undefined =>
    handoffs.get(signRequestId)

const list = (): PendingWalletConnectHandoff[] => [...handoffs.values()]

const unregister = (signRequestId: string): void => {
    if (handoffs.delete(signRequestId)) notify()
}

/**
 * Subscribe to registry changes. Returns an unsubscribe function. Used by
 * the resolver hook to re-render when new handoffs arrive.
 */
const subscribe = (cb: () => void): (() => void) => {
    subscribers.add(cb)
    return () => {
        subscribers.delete(cb)
    }
}

/**
 * Monotonic counter that ticks on every register/unregister. Use as the
 * snapshot for `useSyncExternalStore`; comparing list length would miss
 * a same-tick swap (one unregister + one register collapsing to the same
 * count, which would skip the effect re-run).
 */
const getVersion = (): number => version

/** Test-only: drop every entry. */
const __resetForTests = (): void => {
    handoffs.clear()
    subscribers.clear()
    version = 0
}

export const walletConnectHandoffs = {
    register,
    get,
    list,
    unregister,
    subscribe,
    getVersion,
    __resetForTests,
}
