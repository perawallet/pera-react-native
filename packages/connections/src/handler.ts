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

import type { Network } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
    ConnectionKind,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import type {
    ConnectionErrorScope,
    ConnectionPairOptions,
    ConnectionProposal,
    RawInboundMessage,
    WalletNotice,
} from './models'

export interface ConnectionHandlerContext {
    store: ConnectionStoreAPI
    onProposal(proposal: ConnectionProposal): void
    /** Handlers emit the RAW form; the registry validates it. */
    onMessage(message: RawInboundMessage): void
    onDisconnected(id: ConnectionId): void
    /**
     * Report `{ pairingId }` for a failure before the proposal is approved
     * and `{ connectionId }` after; a pairing entry point correlates on the
     * former, an open session's UI on the latter.
     */
    onError(error: Error, scope?: ConnectionErrorScope): void
}

/**
 * One handler per connection KIND, managing N connections — the
 * `HardwareWalletTransportProvider` shape, not one-per-connection. It owns a
 * lifecycle because protocols differ in how transports map to sessions
 * (WalletConnect v1 is one socket per session; v2 is one relay socket for
 * all of them).
 *
 * `TConnection` is a convenience for implementers. The registry stores the
 * ERASED form and routes by `kind` before dispatching, so a handler only
 * ever receives its own records — but TypeScript's method bivariance does
 * not enforce that, so each implementation must narrow with a type guard on
 * entry.
 */
export interface ConnectionHandler<
    TConnection extends Connection = Connection,
> {
    readonly kind: ConnectionKind

    /**
     * Bind transports and listeners. Called once, AFTER keystore hydration.
     * Must NOT restore: the registry calls {@link restore} next and reconciles
     * the store from what it returns.
     */
    initialize(ctx: ConnectionHandlerContext): Promise<void>
    teardown(): Promise<void>

    /**
     * URI pairing is a capability, not a given: an origin-identified kind
     * (a page calling into the wallet) has no URI and declares neither this
     * nor {@link pair}. Declare both or neither.
     */
    canHandleUri?(uri: string): boolean
    /**
     * Starts a pairing and resolves with a handler-scoped pairing id as soon
     * as the transport is up — NOT when the peer answers. Callers that need
     * the outcome correlate on that id: it is what
     * {@link ConnectionProposal.pairingId} carries, and what `onError`'s
     * scope reports as `pairingId` for failures on this pairing. Opaque
     * above the handler; do not parse it. `opts.origin`, when given, must
     * be written onto the record the eventual approval creates.
     */
    pair?(uri: string, opts?: ConnectionPairOptions): Promise<string>
    /**
     * Kills a pairing that never produced a session, so a late peer answer
     * cannot surface a proposal after the caller has given up on it. Only
     * for protocols whose pairings outlive the caller's interest; one whose
     * pairings expire on their own leaves this undeclared.
     */
    abandonPairing?(pairingId: string): void

    disconnect(id: ConnectionId): Promise<void>
    disconnectAll(): Promise<void>

    /**
     * This handler's authoritative connection set. The registry upserts every
     * record returned and removes stored records of this `kind` that are
     * missing from it, so omitting a connection here is what deletes it.
     */
    restore(): Promise<TConnection[]>

    matchesNetwork(connection: TConnection, network: Network): boolean

    /**
     * Log-safe identifiers for a pairing URI; declared alongside `pair`. MUST
     * NOT return the URI: v1's `key=` and v2's `symKey=` are pairing secrets
     * and error-level log context ships to the crash reporter.
     */
    describeUri?(uri: string): Record<string, string | null>

    /**
     * Present only if the protocol can push wallet-initiated messages.
     * Forward design: nothing reaches this until the registry grows a surface
     * for it.
     */
    notify?(id: ConnectionId, notice: WalletNotice): Promise<void>
}
