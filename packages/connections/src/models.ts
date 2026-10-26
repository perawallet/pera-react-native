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

import type {
    ChainId,
    ChainScope,
    MessageRequest,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    AuthDataSignableData,
    PeraArbitraryDataMessage,
    SourceType,
} from '@perawallet/wallet-core-signing'
import type {
    Connection,
    ConnectionId,
    ConnectionKind,
    ConnectionOrigin,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'

// Re-exported because `InboundMessage.sourceType` is part of this package's
// published surface: the extension realms that carry it across a message hop
// have no reason to depend on the signing package for the type alone.
export type { SourceType }

/** The operations a chain's WalletConnect support may route; the registry validates each into a {@link WalletOperation}. */
export const WALLET_OPERATION_TYPES = [
    'sign-transactions',
    'sign-data',
    'send-transaction',
    'sign-message',
    'sign-typed-data',
    'switch-network',
    'send-batch',
    'show-batch',
] as const

export type WalletOperationType = (typeof WALLET_OPERATION_TYPES)[number]

export type MessageOperationType = Extract<
    WalletOperationType,
    'sign-message' | 'sign-typed-data'
>

/** What a dApp asks to sign, before the wallet stamps the network it signs on. */
export type DappMessageRequest = Omit<MessageRequest, 'scope'>

/**
 * Closed union: a handler that cannot map an inbound message declines at its
 * own envelope boundary rather than emitting an `unknown` variant.
 */
export type WalletOperation =
    | { type: 'sign-transactions'; group: readonly unknown[] }
    | {
          type: 'sign-data'
          payload: AuthDataSignableData | PeraArbitraryDataMessage[]
      }
    | {
          type: 'send-transaction'
          /** Opaque here: only the chain whose `sendTransaction.validate` produced it reads it. */
          request: unknown
      }
    | { type: MessageOperationType; request: DappMessageRequest }
    /** Adds `networkId` to the connection, once the user agrees; the wallet's selection never moves. */
    | { type: 'switch-network'; networkId: NetworkId }
    | {
          type: 'send-batch'
          /** Opaque here: only the chain whose `sendBatch.validate` produced it reads it. */
          request: unknown
      }
    /** Shows the user a batch the peer sent earlier; nothing is signed. */
    | { type: 'show-batch'; batchId: string }

/** Signing results, before the handler envelopes them for its wire. */
export type WalletOperationResult =
    | { type: 'sign-transactions'; signed: Nullable<string>[] }
    | { type: 'sign-data'; signatures: Uint8Array[] }
    /** `txId` is the submitted transaction's chain-native id. */
    | { type: 'send-transaction'; txId: string }
    /** The signature as the chain's message signer assembled it. */
    | { type: MessageOperationType; signature: Uint8Array }
    /** The connection now holds the network; the wire answer is the chain's. */
    | { type: 'switch-network' }
    /** `batchId` is what the peer tracks the batch by. */
    | { type: 'send-batch'; batchId: string }
    | { type: 'show-batch' }

/** Wallet-initiated push. Only handlers implementing `notify` receive these. */
export type WalletNotice =
    | {
          type: 'accounts-changed'
          chainId: ChainId
          /** Every address the wallet now holds on `chainId`. */
          accounts: string[]
          /** The addresses this change added or removed. */
          changed: string[]
      }
    | { type: 'network-changed'; scope: ChainScope }

export const walletNoticeChainId = (notice: WalletNotice): ChainId =>
    notice.type === 'network-changed' ? notice.scope.chainId : notice.chainId

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
    /**
     * The chain this request answers for. The handler declares it, the same
     * way it declares `sourceType`; a message naming a chain with no
     * registered adapter is refused rather than passed through unvalidated.
     */
    chainId: ChainId
    /** Handler-scoped and opaque (WalletConnect id, DIDComm `thid`, ...). Do not parse it. */
    correlationId: string
    /**
     * How the signing pipeline labels this request's origin — it drives
     * `isInteractiveSource`/`isExternalCallbackSource` membership, the signing
     * sheet's per-source branch and analytics. The HANDLER declares it, so a
     * new transport reaches the pipeline without the neutral layer knowing it
     * exists.
     */
    sourceType: SourceType
    /**
     * The accounts the signer may sign for. Carried on the message rather
     * than looked up downstream: a store lookup could race a concurrent disconnect.
     */
    authorizedAccounts: string[]
    /**
     * Approved-session snapshot that becomes a `SignRequest`'s `sourceMetadata`,
     * the anti-spoofing identity on the signing sheet; on the message for the
     * same reason as `authorizedAccounts`.
     */
    peer: ConnectionPeer
    /**
     * Origin the transport itself attested (the browser's `sender.origin`),
     * never a peer-asserted value. Feeds the pipeline's ARC-60 domain-binding
     * check; unset when nothing attested one, as on a paste or QR pairing.
     */
    verifiedOrigin?: string
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
     * The peer will no longer take an answer to this request; whatever is
     * holding it open for the user (a signing sheet) must let go. Never a
     * new request kind on the raw side: the handler reports it through
     * `ConnectionHandlerContext.onRequestExpired`.
     */
    | {
          kind: 'request-expired'
          connectionId: ConnectionId
          correlationId: string
      }
    /**
     * The connection's record is gone, whichever side ended it; every request
     * it still has open must be let go of, as for `request-expired`.
     */
    | { kind: 'connection-closed'; connectionId: ConnectionId }

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
    /**
     * Browser-verified origin of the requesting page, when the handler's
     * transport can vouch for one. Absent for URI pairings, whose origin the
     * host learns from the pair command instead.
     */
    requesterOrigin?: string
    requested: {
        /** Handler-resolved: v1's 4160 wildcard already expanded. */
        networks: NetworkId[]
        /**
         * The chains the session would include, each with a requested network
         * the wallet serves; the approval sheet lists only accounts on these.
         */
        chains: ChainId[]
        methods: string[]
    }
    expiresAt: number
    approve(accounts: string[]): Promise<Connection>
    reject(reason?: string): Promise<void>
}
