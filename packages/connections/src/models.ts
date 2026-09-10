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
 * Closed union: a handler that cannot map an inbound message declines at its
 * own envelope boundary rather than emitting an `unknown` variant.
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
 * The origin is known at `pair()` time but has no record to live on until the
 * proposal is approved, so the handler carries it across.
 */
export type ConnectionPairOptions = {
    origin?: ConnectionOrigin
}

/**
 * Two fields, not one id: a pairing and its connection share an id on
 * WalletConnect v1 only. Empty for a subjectless failure (a handler failing to boot).
 */
export type ConnectionErrorScope = {
    connectionId?: ConnectionId
    pairingId?: string
}

export const matchesScope = (
    subject: { pairingId?: string; connectionId?: ConnectionId },
    scope: ConnectionErrorScope,
): boolean =>
    (scope.pairingId !== undefined && scope.pairingId === subject.pairingId) ||
    (scope.connectionId !== undefined &&
        scope.connectionId === subject.connectionId)

type MessageBase = {
    connectionId: ConnectionId
    /** Handler-scoped and opaque (WalletConnect id, DIDComm `thid`, ...). Do not parse it. */
    correlationId: string
    /**
     * Becomes ARC-0001's `authorizedAddresses`. Carried on the message rather
     * than looked up downstream: a store lookup could race a concurrent disconnect.
     */
    authorizedAccounts: string[]
    /**
     * Approved-session snapshot that becomes a `SignRequest`'s `sourceMetadata`,
     * the anti-spoofing identity on the signing sheet; on the message for the
     * same reason as `authorizedAccounts`.
     */
    peer: ConnectionPeer
    respond(result: WalletOperationResult): Promise<void>
    reject(error: Error): Promise<void>
}

export type InboundMessage =
    | ({ kind: 'request'; operation: WalletOperation } & MessageBase)
    | {
          kind: 'notification'
          connectionId: ConnectionId
          event: ConnectionEvent
      }

/**
 * Envelope decoded and operation type known, payload unvalidated; the registry
 * validates before constructing the {@link InboundMessage} subscribers receive.
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
 * Carries its own capabilities rather than an id the caller could forge.
 * Transient and never persisted, so the closures are safe.
 */
export interface ConnectionProposal {
    kind: ConnectionKind
    proposalId: string
    /**
     * The value `handler.pair()` resolved with, when the handler can correlate
     * the two (v1: one connector per pairing). Without it a proposal from any
     * live connection would read as this pairing succeeding.
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
