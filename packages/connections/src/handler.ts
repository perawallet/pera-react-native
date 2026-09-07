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
    /** Report `{ pairingId }` for a failure before the proposal is approved and `{ connectionId }` after. */
    onError(error: Error, scope?: ConnectionErrorScope): void
}

/**
 * One handler per kind, managing N connections (v1 is one socket per session,
 * v2 one relay socket for all). The registry routes by `kind`, but method
 * bivariance does not enforce `TConnection`, so narrow with a type guard on entry.
 */
export interface ConnectionHandler<
    TConnection extends Connection = Connection,
> {
    readonly kind: ConnectionKind

    /**
     * Called once, after keystore hydration. Must not restore: the registry
     * calls {@link restore} next and reconciles the store from what it returns.
     */
    initialize(ctx: ConnectionHandlerContext): Promise<void>
    teardown(): Promise<void>

    /**
     * Optional because an origin-identified kind (a page calling into the
     * wallet) has no URI. Declare both this and {@link pair} or neither.
     */
    canHandleUri?(uri: string): boolean
    /**
     * Resolves with an opaque pairing id as soon as the transport is up, not
     * when the peer answers; {@link ConnectionProposal.pairingId} and `onError`'s
     * scope carry it. `opts.origin` must be written onto the approved record.
     */
    pair?(uri: string, opts?: ConnectionPairOptions): Promise<string>
    /**
     * Kills a pairing that never produced a session so a late peer answer cannot
     * surface a proposal. Leave undeclared when pairings expire on their own.
     */
    abandonPairing?(pairingId: string): void

    disconnect(id: ConnectionId): Promise<void>
    disconnectAll(): Promise<void>

    /**
     * Authoritative: the registry removes stored records of this `kind` that
     * are missing from the result, so omitting a connection is what deletes it.
     */
    restore(): Promise<TConnection[]>

    matchesNetwork(connection: TConnection, network: Network): boolean

    /**
     * The methods this connection was approved for, as the settings panel
     * lists them. Handler-declared because the key is kind-specific — v1
     * stored `permissions`, v2 stores `methods`.
     */
    methodsFor(connection: TConnection): string[]

    /**
     * Log-safe identifiers for a pairing URI. Must not include the URI: v1's
     * `key=` and v2's `symKey=` are pairing secrets and error logs ship to the crash reporter.
     */
    describeUri?(uri: string): Record<string, string | null>

    /** Present only if the protocol can push wallet-initiated messages. */
    notify?(id: ConnectionId, notice: WalletNotice): Promise<void>
}
