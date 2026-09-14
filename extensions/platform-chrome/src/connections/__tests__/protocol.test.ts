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

import type { WalletOperation } from '@perawallet/wallet-core-connections'
import { describe, expect, it } from 'vitest'
import {
    CONNECTIONS_CONTROL_SCOPE,
    CONNECTIONS_EVENT_SCOPE,
    CONNECTIONS_REQUEST_SCOPE,
    decodeWalletOperation,
    decodeWalletOperationResult,
    encodeWalletOperation,
    encodeWalletOperationResult,
    isConnectionApprovalRequestMessage,
    isConnectionsAck,
    isConnectionsControlMessage,
    isConnectionsEventMessage,
    isWireWalletOperationResult,
} from '../protocol'

const PEER = { name: 'dApp', url: 'https://dapp.example', icons: [] }

// JSON.parse(JSON.stringify(...)) is what chrome.runtime.sendMessage does to
// a payload, so a round trip through it is the real test of "wire-safe".
const overTheWire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('wallet operation wire codec', () => {
    it('round-trips a sign-transactions group unchanged', () => {
        const operation: WalletOperation = {
            type: 'sign-transactions',
            group: [{ txn: 'dHhu', signers: [] }],
        }

        const decoded = decodeWalletOperation(
            overTheWire(encodeWalletOperation(operation)),
        )

        expect(decoded).toEqual(operation)
    })

    it('round-trips a legacy arbitrary-data array unchanged', () => {
        const operation: WalletOperation = {
            type: 'sign-data',
            payload: [{ signer: 'AAAA', data: 'ZGF0YQ==', chainId: 4160 }],
        }

        const decoded = decodeWalletOperation(
            overTheWire(encodeWalletOperation(operation)),
        )

        expect(decoded).toEqual(operation)
    })

    it('carries ARC-60 authenticatorData as base64 and restores the bytes', () => {
        const authenticatorData = new Uint8Array([1, 2, 3, 250, 251, 252])
        const operation: WalletOperation = {
            type: 'sign-data',
            payload: {
                type: 'arc60',
                stdSigData: {
                    data: 'ZGF0YQ==',
                    signer: 'AAAA',
                    domain: 'dapp.example',
                    authenticatorData,
                    requestId: 'r1',
                },
                metadata: { scope: 1, encoding: 'base64' },
            },
        }

        const wire = overTheWire(encodeWalletOperation(operation))
        const decoded = decodeWalletOperation(wire)

        expect(
            wire.type === 'sign-data' &&
                !Array.isArray(wire.payload) &&
                wire.payload.stdSigData.authenticatorData,
        ).toEqual(expect.any(String))
        expect(decoded).toEqual(operation)
        expect(
            decoded.type === 'sign-data' &&
                !Array.isArray(decoded.payload) &&
                decoded.payload.stdSigData.authenticatorData,
        ).toBeInstanceOf(Uint8Array)
    })

    it('round-trips sign-data signatures through base64', () => {
        const result = {
            type: 'sign-data' as const,
            signatures: [new Uint8Array([9, 8, 7]), new Uint8Array([0, 255])],
        }

        const wire = overTheWire(encodeWalletOperationResult(result))

        expect(isWireWalletOperationResult(wire)).toBe(true)
        expect(decodeWalletOperationResult(wire)).toEqual(result)
    })

    it('leaves a sign-transactions result untouched', () => {
        const result = {
            type: 'sign-transactions' as const,
            signed: ['c3R4bg==', null],
        }

        expect(
            decodeWalletOperationResult(
                overTheWire(encodeWalletOperationResult(result)),
            ),
        ).toEqual(result)
    })
})

describe('isConnectionsControlMessage', () => {
    it('accepts a pair command with an optional requester origin', () => {
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=00',
                requesterOrigin: 'https://dapp.example',
            }),
        ).toBe(true)
    })

    it('rejects a pair command whose requester origin is not a string', () => {
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=00',
                requesterOrigin: 42,
            }),
        ).toBe(false)
    })

    it('accepts an approve-proposal command with string accounts only', () => {
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'approve-proposal',
                proposalId: 'p1',
                accounts: ['AAAA'],
            }),
        ).toBe(true)
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'approve-proposal',
                proposalId: 'p1',
                accounts: ['AAAA', 42],
            }),
        ).toBe(false)
    })

    it('accepts a respond command whose success outcome carries a wire result', () => {
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'respond',
                connectionId: 'c1',
                correlationId: '7',
                outcome: {
                    ok: true,
                    result: { type: 'sign-transactions', signed: ['c3R4bg=='] },
                },
            }),
        ).toBe(true)
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'respond',
                connectionId: 'c1',
                correlationId: '7',
                outcome: { ok: true, result: ['c3R4bg=='] },
            }),
        ).toBe(false)
    })

    it('rejects another scope, an unknown kind and a non-object', () => {
        expect(
            isConnectionsControlMessage({
                scope: 'pera-db-control',
                kind: 'pair',
            }),
        ).toBe(false)
        expect(
            isConnectionsControlMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                kind: 'nope',
            }),
        ).toBe(false)
        expect(isConnectionsControlMessage(null)).toBe(false)
    })
})

describe('isConnectionApprovalRequestMessage', () => {
    it('accepts a connection-proposal request', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-proposal',
                    proposalId: 'p1',
                    pairingId: 'pair-1',
                    connectionKind: 'walletconnect-v1',
                    peer: PEER,
                    requested: { networks: ['mainnet'], methods: [] },
                    expiresAt: 1,
                },
            }),
        ).toBe(true)
    })

    it('accepts a connection-request carrying a wire operation', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-request',
                    connectionId: 'c1',
                    correlationId: '9',
                    operation: { type: 'sign-transactions', group: [] },
                    authorizedAccounts: ['AAAA'],
                    peer: PEER,
                },
            }),
        ).toBe(true)
    })

    it('accepts a connection-error notice without a peer', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-error',
                    reason: 'network-mismatch',
                    activeNetwork: 'mainnet',
                },
            }),
        ).toBe(true)
    })

    it('rejects another scope and an unknown request kind', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                request: { kind: 'connection-proposal' },
            }),
        ).toBe(false)
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: { kind: 'nope' },
            }),
        ).toBe(false)
    })
})

describe('isConnectionsEventMessage', () => {
    it('accepts a proposal event', () => {
        expect(
            isConnectionsEventMessage({
                scope: CONNECTIONS_EVENT_SCOPE,
                event: {
                    kind: 'proposal',
                    proposal: {
                        kind: 'walletconnect-v1',
                        proposalId: 'p1',
                        peer: PEER,
                        requested: { networks: ['testnet'], methods: [] },
                        expiresAt: 1,
                    },
                },
            }),
        ).toBe(true)
    })

    it('accepts an error event with an optional message key and scope', () => {
        expect(
            isConnectionsEventMessage({
                scope: CONNECTIONS_EVENT_SCOPE,
                event: {
                    kind: 'error',
                    name: 'ConnectionsError',
                    message: 'boom',
                    messageKey: 'errors.connections.no_handler',
                    scope: { pairingId: 'pair-1' },
                },
            }),
        ).toBe(true)
    })

    it('rejects an error event with no message', () => {
        expect(
            isConnectionsEventMessage({
                scope: CONNECTIONS_EVENT_SCOPE,
                event: { kind: 'error', name: 'Error' },
            }),
        ).toBe(false)
    })
})

describe('isConnectionsAck', () => {
    it('accepts only { ok: true }', () => {
        expect(isConnectionsAck({ ok: true })).toBe(true)
        expect(isConnectionsAck({ ok: false })).toBe(false)
        expect(isConnectionsAck(undefined)).toBe(false)
    })
})
