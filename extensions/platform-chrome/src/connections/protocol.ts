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
    ConnectionErrorScope,
    ConnectionProposal,
    WalletOperation,
    WalletOperationResult,
} from '@perawallet/wallet-core-connections'
import {
    decodeFromBase64,
    encodeToBase64,
    type Network,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionKind,
    ConnectionOrigin,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string')

const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === 'string'

// chrome.runtime.sendMessage is JSON; the only non-JSON fields on an
// operation / result are byte arrays, carried as base64 on the wire.

type SignDataPayload = Extract<
    WalletOperation,
    { type: 'sign-data' }
>['payload']
type LegacySignDataPayload = Extract<SignDataPayload, readonly unknown[]>
type Arc60SignDataPayload = Exclude<SignDataPayload, readonly unknown[]>

type WireArc60SignDataPayload = Omit<Arc60SignDataPayload, 'stdSigData'> & {
    stdSigData: Omit<
        Arc60SignDataPayload['stdSigData'],
        'authenticatorData'
    > & {
        /** base64 of `authenticatorData`. */
        authenticatorData: string
    }
}

export type WireWalletOperation =
    | Extract<WalletOperation, { type: 'sign-transactions' }>
    | {
          type: 'sign-data'
          payload: WireArc60SignDataPayload | LegacySignDataPayload
      }

export type WireWalletOperationResult =
    | Extract<WalletOperationResult, { type: 'sign-transactions' }>
    | {
          type: 'sign-data'
          /** base64 of each signature. */
          signatures: string[]
      }

export const encodeWalletOperation = (
    operation: WalletOperation,
): WireWalletOperation => {
    if (operation.type !== 'sign-data') return operation
    if (Array.isArray(operation.payload)) {
        return { type: 'sign-data', payload: operation.payload }
    }
    const payload = operation.payload as Arc60SignDataPayload
    return {
        type: 'sign-data',
        payload: {
            ...payload,
            stdSigData: {
                ...payload.stdSigData,
                authenticatorData: encodeToBase64(
                    payload.stdSigData.authenticatorData,
                ),
            },
        },
    }
}

export const decodeWalletOperation = (
    operation: WireWalletOperation,
): WalletOperation => {
    if (operation.type !== 'sign-data') return operation
    if (Array.isArray(operation.payload)) {
        return { type: 'sign-data', payload: operation.payload }
    }
    const payload = operation.payload as WireArc60SignDataPayload
    return {
        type: 'sign-data',
        payload: {
            ...payload,
            stdSigData: {
                ...payload.stdSigData,
                authenticatorData: decodeFromBase64(
                    payload.stdSigData.authenticatorData,
                ),
            },
        },
    }
}

export const encodeWalletOperationResult = (
    result: WalletOperationResult,
): WireWalletOperationResult => {
    if (result.type !== 'sign-data') return result
    return {
        type: 'sign-data',
        signatures: result.signatures.map(encodeToBase64),
    }
}

export const decodeWalletOperationResult = (
    result: WireWalletOperationResult,
): WalletOperationResult => {
    if (result.type !== 'sign-data') return result
    return {
        type: 'sign-data',
        signatures: result.signatures.map(decodeFromBase64),
    }
}

export const isWireWalletOperation = (
    value: unknown,
): value is WireWalletOperation => {
    if (!isRecord(value)) return false
    switch (value.type) {
        case 'sign-transactions': {
            return Array.isArray(value.group)
        }
        case 'sign-data': {
            return Array.isArray(value.payload) || isRecord(value.payload)
        }
        default: {
            return false
        }
    }
}

export const isWireWalletOperationResult = (
    value: unknown,
): value is WireWalletOperationResult => {
    if (!isRecord(value)) return false
    switch (value.type) {
        case 'sign-transactions': {
            return (
                Array.isArray(value.signed) &&
                value.signed.every(
                    item => item === null || typeof item === 'string',
                )
            )
        }
        case 'sign-data': {
            return isStringArray(value.signatures)
        }
        default: {
            return false
        }
    }
}

/** UI / service worker → offscreen registry host, request/response. */
export const CONNECTIONS_CONTROL_SCOPE = 'pera-connections-control' as const

export type ConnectionsControlMessage = {
    scope: typeof CONNECTIONS_CONTROL_SCOPE
} & (
    | {
          kind: 'pair'
          uri: string
          origin?: ConnectionOrigin
          /**
           * Browser-verified origin of the requesting tab, stamped by the service
           * worker from `sender.origin`; absent for paste/QR pairings. NOT the
           * dApp-asserted peer URL.
           */
          requesterOrigin?: string
      }
    | { kind: 'abandon-pairing'; pairingId: string }
    | { kind: 'disconnect'; connectionId: string }
    | { kind: 'disconnect-all' }
    | { kind: 'reconnect-all' }
    | { kind: 'approve-proposal'; proposalId: string; accounts: string[] }
    | { kind: 'reject-proposal'; proposalId: string; reason?: string }
    | {
          kind: 'respond'
          connectionId: string
          correlationId: string
          outcome:
              | { ok: true; result: WireWalletOperationResult }
              | { ok: false; message: string }
      }
)

export type ConnectionsControlKind = ConnectionsControlMessage['kind']

export type ConnectionsControlResultByKind = {
    pair: { pairingId: string }
    'abandon-pairing': void
    disconnect: void
    'disconnect-all': void
    'reconnect-all': void
    'approve-proposal': { connection: Connection }
    'reject-proposal': void
    respond: void
}

export type ConnectionsControlResult<K extends ConnectionsControlKind> =
    ConnectionsControlResultByKind[K]

export type ConnectionsControlResponse =
    | { ok: true; result?: unknown }
    | { ok: false; error: string }

export const isConnectionsControlResponse = (
    value: unknown,
): value is ConnectionsControlResponse => {
    if (!isRecord(value)) return false
    if (value.ok === true) return true
    return value.ok === false && typeof value.error === 'string'
}

const isRespondOutcome = (
    value: unknown,
): value is Extract<
    ConnectionsControlMessage,
    { kind: 'respond' }
>['outcome'] => {
    if (!isRecord(value)) return false
    if (value.ok === true) return isWireWalletOperationResult(value.result)
    return value.ok === false && typeof value.message === 'string'
}

export const isConnectionsControlMessage = (
    value: unknown,
): value is ConnectionsControlMessage => {
    if (!isRecord(value)) return false
    if (value.scope !== CONNECTIONS_CONTROL_SCOPE) return false
    switch (value.kind) {
        case 'pair': {
            return (
                typeof value.uri === 'string' &&
                (value.origin === undefined || isRecord(value.origin)) &&
                isOptionalString(value.requesterOrigin)
            )
        }
        case 'abandon-pairing': {
            return typeof value.pairingId === 'string'
        }
        case 'disconnect': {
            return typeof value.connectionId === 'string'
        }
        case 'disconnect-all':
        case 'reconnect-all': {
            return true
        }
        case 'approve-proposal': {
            return (
                typeof value.proposalId === 'string' &&
                isStringArray(value.accounts)
            )
        }
        case 'reject-proposal': {
            return (
                typeof value.proposalId === 'string' &&
                isOptionalString(value.reason)
            )
        }
        case 'respond': {
            return (
                typeof value.connectionId === 'string' &&
                typeof value.correlationId === 'string' &&
                isRespondOutcome(value.outcome)
            )
        }
        default: {
            return false
        }
    }
}

/** Offscreen → service worker, acked: what needs an approval surface. */
export const CONNECTIONS_REQUEST_SCOPE = 'pera-connections-request' as const

export type ConnectionApprovalRequest =
    | {
          kind: 'connection-proposal'
          proposalId: string
          pairingId?: string
          connectionKind: ConnectionKind
          peer: ConnectionPeer
          requested: { networks: Network[]; methods: string[] }
          expiresAt: number
          /** See `ConnectionsControlMessage`'s `pair.requesterOrigin`. */
          requesterOrigin?: string
      }
    | {
          kind: 'connection-request'
          connectionId: string
          correlationId: string
          operation: WireWalletOperation
          authorizedAccounts: string[]
          peer: ConnectionPeer
      }
    // Notification-only: the host already refused the peer, and the surface
    // exists so the user learns why their click did nothing.
    | {
          kind: 'connection-error'
          reason: ConnectionErrorReason
          pairingId?: string
          peer?: ConnectionPeer
          /** Only the network-mismatch notice names a network. */
          activeNetwork?: Network
      }

/**
 * `delivery-failed` is the post-decision case: the approval window has already
 * closed on the bridge ack, so this notice is the only place left to tell the
 * user the dApp never heard their answer.
 */
export const CONNECTION_ERROR_REASONS = [
    'network-mismatch',
    'delivery-failed',
] as const

export type ConnectionErrorReason = (typeof CONNECTION_ERROR_REASONS)[number]

const isConnectionErrorReason = (
    value: unknown,
): value is ConnectionErrorReason =>
    CONNECTION_ERROR_REASONS.includes(value as ConnectionErrorReason)

export type ConnectionApprovalRequestMessage = {
    scope: typeof CONNECTIONS_REQUEST_SCOPE
    request: ConnectionApprovalRequest
}

const isPeer = (value: unknown): value is ConnectionPeer =>
    isRecord(value) && typeof value.name === 'string'

export const isConnectionApprovalRequest = (
    value: unknown,
): value is ConnectionApprovalRequest => {
    if (!isRecord(value)) return false
    switch (value.kind) {
        case 'connection-proposal': {
            return (
                typeof value.proposalId === 'string' &&
                isOptionalString(value.pairingId) &&
                typeof value.connectionKind === 'string' &&
                isPeer(value.peer) &&
                isRecord(value.requested) &&
                isStringArray(value.requested.networks) &&
                isStringArray(value.requested.methods) &&
                typeof value.expiresAt === 'number' &&
                isOptionalString(value.requesterOrigin)
            )
        }
        case 'connection-request': {
            return (
                typeof value.connectionId === 'string' &&
                typeof value.correlationId === 'string' &&
                isWireWalletOperation(value.operation) &&
                isStringArray(value.authorizedAccounts) &&
                isPeer(value.peer)
            )
        }
        case 'connection-error': {
            if (!isConnectionErrorReason(value.reason)) return false
            if (!isOptionalString(value.pairingId)) return false
            if (value.peer !== undefined && !isPeer(value.peer)) return false
            // Kept required where the copy interpolates it.
            return (
                value.reason !== 'network-mismatch' ||
                typeof value.activeNetwork === 'string'
            )
        }
        default: {
            return false
        }
    }
}

export const isConnectionApprovalRequestMessage = (
    value: unknown,
): value is ConnectionApprovalRequestMessage =>
    isRecord(value) &&
    value.scope === CONNECTIONS_REQUEST_SCOPE &&
    isConnectionApprovalRequest(value.request)

/**
 * Every listener on the request scope must answer, or Chrome closes the port and
 * the sender's await settles wrongly. For a proposal/request the ack means
 * ACCEPTANCE (the decision returns on the control scope); for an error, DISMISSAL.
 */
export type ConnectionsAck = { ok: true }

export const isConnectionsAck = (value: unknown): value is ConnectionsAck =>
    isRecord(value) && value.ok === true

/** Offscreen → every UI realm, fire-and-forget. */
export const CONNECTIONS_EVENT_SCOPE = 'pera-connections-event' as const

/** A `ConnectionProposal` without its `approve` / `reject` closures. */
export type ConnectionProposalSummary = Omit<
    ConnectionProposal,
    'approve' | 'reject'
>

export type ConnectionsEvent =
    | { kind: 'proposal'; proposal: ConnectionProposalSummary }
    | {
          kind: 'error'
          message: string
          name: string
          /** `AppError.metadata.messageKey`, so the UI can still translate it. */
          messageKey?: string
          scope?: ConnectionErrorScope
      }

export type ConnectionsEventMessage = {
    scope: typeof CONNECTIONS_EVENT_SCOPE
    event: ConnectionsEvent
}

const isProposalSummary = (
    value: unknown,
): value is ConnectionProposalSummary =>
    isRecord(value) &&
    typeof value.kind === 'string' &&
    typeof value.proposalId === 'string' &&
    isOptionalString(value.pairingId) &&
    isPeer(value.peer) &&
    isRecord(value.requested) &&
    isStringArray(value.requested.networks) &&
    isStringArray(value.requested.methods) &&
    typeof value.expiresAt === 'number'

export const isConnectionsEvent = (
    value: unknown,
): value is ConnectionsEvent => {
    if (!isRecord(value)) return false
    switch (value.kind) {
        case 'proposal': {
            return isProposalSummary(value.proposal)
        }
        case 'error': {
            return (
                typeof value.message === 'string' &&
                typeof value.name === 'string' &&
                isOptionalString(value.messageKey) &&
                (value.scope === undefined || isRecord(value.scope))
            )
        }
        default: {
            return false
        }
    }
}

export const isConnectionsEventMessage = (
    value: unknown,
): value is ConnectionsEventMessage =>
    isRecord(value) &&
    value.scope === CONNECTIONS_EVENT_SCOPE &&
    isConnectionsEvent(value.event)
