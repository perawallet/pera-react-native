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

import type { Arc0001WalletTransaction } from '@perawallet/wallet-core-blockchain'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type {
    Arc60SignableData,
    PeraArbitraryDataMessage,
} from '@perawallet/wallet-core-signing'
import type {
    Connection,
    ConnectionId,
    ConnectionKind,
    ConnectionOrigin,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'

export type { Arc0001WalletTransaction }

/** ARC-0001 request payload: one entry per transaction slot. */
export type Arc0001TxnGroup = Arc0001WalletTransaction[]

export const WALLET_OPERATION_TYPES = [
    'sign-transactions',
    'sign-data',
] as const

export type WalletOperationType = (typeof WALLET_OPERATION_TYPES)[number]

/**
 * What a peer wants the wallet to do. Transport-independent: ARC-0001 and
 * ARC-60 define these regardless of whether they arrive over WalletConnect,
 * DIDComm or anything else. The union is CLOSED — a handler that cannot map
 * an inbound message declines at its own envelope boundary rather than
 * emitting an `unknown` variant.
 */
export type WalletOperation =
    | { type: 'sign-transactions'; group: Arc0001TxnGroup }
    | {
          type: 'sign-data'
          payload: Arc60SignableData | PeraArbitraryDataMessage[]
      }

/** ARC-0001 / ARC-60 response payloads. The handler owns enveloping. */
export type WalletOperationResult =
    | { type: 'sign-transactions'; signed: Nullable<string>[] }
    | { type: 'sign-data'; signatures: Uint8Array[] }

/** Wallet-initiated push. Only handlers implementing `notify` receive these. */
export type WalletNotice =
    | { type: 'accounts-changed'; accounts: string[] }
    | { type: 'network-changed'; network: Network }

export type ConnectionEvent =
    | { type: 'session-expiring'; expiresAt: number }
    | { type: 'peer-metadata-changed'; peer: ConnectionPeer }

/**
 * What a handler knows about a pairing before the peer has answered. The
 * origin is known at `pair()` time but only has a record to live on once the
 * proposal is approved, so the handler carries it across.
 */
export type ConnectionPairOptions = {
    origin?: ConnectionOrigin
}

/**
 * Which thing an error is about. Kept as two fields rather than one id
 * because a pairing and the connection it produces are the same value only
 * on WalletConnect v1; v2's pairing topic is not its session topic. Empty
 * for a failure with no subject, such as a handler failing to boot.
 */
export type ConnectionErrorScope = {
    connectionId?: ConnectionId
    pairingId?: string
}

type MessageBase = {
    connectionId: ConnectionId
    /**
     * Handler-scoped and OPAQUE. Covers WalletConnect's numeric id, DIDComm's
     * `thid` and STOMP receipt ids only for as long as nothing above the
     * handler parses it. Do not parse it.
     */
    correlationId: string
    /**
     * The accounts this connection was approved for. Travels ON the message
     * rather than being looked up downstream: it becomes ARC-0001's
     * `authorizedAddresses`, which is what stops a session approved for
     * account A from signing for account B. A store lookup could race a
     * concurrent disconnect, or simply be forgotten; a required field cannot.
     */
    authorizedAccounts: string[]
    /**
     * The connection's peer identity — name, url, icons. Travels ON the
     * message for exactly the same reason `authorizedAccounts` does: it
     * becomes a `SignRequest`'s `sourceMetadata`, the anti-spoofing dApp
     * identity shown on the signing sheet, stamped from the approved
     * session snapshot rather than looked up downstream. A store lookup
     * could race a concurrent disconnect, or simply be forgotten; a
     * required field cannot.
     */
    peer: ConnectionPeer
    respond(result: WalletOperationResult): Promise<void>
    reject(error: Error): Promise<void>
}

export type InboundMessage =
    | ({ kind: 'request'; operation: WalletOperation } & MessageBase)
    // Forward design: no handler emits this arm until the registry grows a
    // surface for wallet-initiated messages.
    | {
          kind: 'notification'
          connectionId: ConnectionId
          event: ConnectionEvent
      }

/**
 * What a handler emits: the envelope is decoded and the operation type known,
 * but the payload is unvalidated. The registry validates and only then
 * constructs the typed {@link InboundMessage} subscribers receive.
 */
export type RawInboundMessage =
    | ({
          kind: 'request'
          rawOperation: { type: WalletOperationType; params: unknown }
      } & MessageBase)
    | {
          kind: 'notification'
          connectionId: ConnectionId
          event: ConnectionEvent
      }

/**
 * An inbound connection request. Carries its own capabilities rather than an
 * id the caller could forge and the handler would look up in a side-table.
 * Transient — never persisted, so the closures are safe.
 */
export interface ConnectionProposal {
    kind: ConnectionKind
    proposalId: string
    /**
     * The pairing this proposal answers — the value `handler.pair()`
     * resolved with. Present only when the handler can correlate the two
     * (v1 can: one connector per pairing). It is what lets a pairing entry
     * point tell ITS dApp's answer apart from an unrelated session's
     * traffic; without it a proposal from any live connection would read as
     * this pairing succeeding.
     */
    pairingId?: string
    peer: ConnectionPeer
    requested: {
        /** Handler-resolved: v1's 4160 wildcard already expanded. */
        networks: Network[]
        methods: string[]
    }
    expiresAt: number
    approve(accounts: string[]): Promise<Connection>
    reject(reason?: string): Promise<void>
}
