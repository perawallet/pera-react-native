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
    decodeSignedTransactions,
    decodeWalletOperation,
    decodeWalletOperationResult,
    encodeSignedTransactions,
    encodeWalletOperation,
    encodeWalletOperationResult,
    isConnectionApprovalRequestMessage,
    isConnectionsAck,
    isConnectionsControlMessage,
    isConnectionsEventMessage,
    isWireSignedTransactions,
    isWireWalletOperation,
    isWireWalletOperationResult,
} from '../protocol'

const PEER = { name: 'dApp', url: 'https://dapp.example', icons: [] }

// JSON.parse(JSON.stringify(...)) is what chrome.runtime.sendMessage does to
// a payload, so a round trip through it is the real test of "wire-safe".
const overTheWire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('signed transactions wire codec', () => {
    it('round-trips signed transactions through the wire', () => {
        const signed = [
            { scope: SCOPE, id: '0xabc', bytes: new Uint8Array([1, 2, 3]) },
        ]

        const wire = overTheWire(encodeSignedTransactions(signed))

        expect(isWireSignedTransactions(wire)).toBe(true)
        expect(decodeSignedTransactions(wire)).toEqual(signed)
    })

    it('refuses an empty list, non-string bytes and a scope without networkId', () => {
        expect(isWireSignedTransactions([])).toBe(false)
        expect(
            isWireSignedTransactions([{ scope: SCOPE, id: '0xabc', bytes: 1 }]),
        ).toBe(false)
        expect(
            isWireSignedTransactions([
                { scope: { chainId: 'ethereum' }, id: '0xabc', bytes: 'AQID' },
            ]),
        ).toBe(false)
    })
})

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
                type: 'auth-data',
                authData: {
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
                wire.payload.authData.authenticatorData,
        ).toEqual(expect.any(String))
        expect(decoded).toEqual(operation)
        expect(
            decoded.type === 'sign-data' &&
                !Array.isArray(decoded.payload) &&
                decoded.payload.authData.authenticatorData,
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

    it('round-trips a send-transaction request with bigints through the wire', () => {
        const request = {
            from: '0xabc',
            to: '0xdef',
            value: 10n ** 30n,
            data: '0x',
            gas: 21000n,
            accessList: [{ address: '0x1', storageKeys: ['0x2'] }],
        }

        const wire = encodeWalletOperation({
            type: 'send-transaction',
            request,
        })

        expect(overTheWire(wire)).toEqual(wire)
        expect(isWireWalletOperation(wire)).toBe(true)
        expect(decodeWalletOperation(overTheWire(wire))).toEqual({
            type: 'send-transaction',
            request,
        })
    })

    it('round-trips a send-transaction result', () => {
        const result = {
            type: 'send-transaction',
            txId: '0x' + 'ab'.repeat(32),
        } as const

        const wire = overTheWire(encodeWalletOperationResult(result))

        expect(isWireWalletOperationResult(wire)).toBe(true)
        expect(decodeWalletOperationResult(wire)).toEqual(result)
    })

    it('rejects a send-transaction wire result without a txId', () => {
        expect(isWireWalletOperationResult({ type: 'send-transaction' })).toBe(
            false,
        )
    })

    it('refuses to encode a batch operation or result, which no browser chain serves', () => {
        expect(() =>
            encodeWalletOperation({ type: 'send-batch', request: {} }),
        ).toThrow(/send-batch/)
        expect(() =>
            encodeWalletOperation({ type: 'show-batch', batchId: 'b' }),
        ).toThrow(/show-batch/)
        expect(() =>
            encodeWalletOperationResult({ type: 'send-batch', batchId: 'b' }),
        ).toThrow(/send-batch/)
        expect(() =>
            encodeWalletOperationResult({ type: 'show-batch' }),
        ).toThrow(/show-batch/)
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

    it.each(['sign-message', 'sign-typed-data'] as const)(
        'round-trips a %s operation unchanged and the guard accepts it',
        type => {
            const operation: WalletOperation = {
                type,
                request: {
                    method: 'plain',
                    signer: '0xabc',
                    payload: { message: '0x68656c6c6f' },
                },
            }

            const wire = overTheWire(encodeWalletOperation(operation))

            expect(isWireWalletOperation(wire)).toBe(true)
            expect(decodeWalletOperation(wire)).toEqual(operation)
        },
    )

    it.each(['sign-message', 'sign-typed-data'] as const)(
        'round-trips a %s signature through base64',
        type => {
            const result = {
                type,
                signature: new Uint8Array([1, 2, 255]),
            }

            const wire = overTheWire(encodeWalletOperationResult(result))

            expect(isWireWalletOperationResult(wire)).toBe(true)
            expect(wire).toEqual({ type, signature: 'AQL/' })
            expect(decodeWalletOperationResult(wire)).toEqual(result)
        },
    )

    it('round-trips a switch-network operation and its result unchanged, and the guards accept them', () => {
        const operation: WalletOperation = {
            type: 'switch-network',
            networkId: 'sepolia',
        }
        const result = { type: 'switch-network' as const }

        const wireOperation = overTheWire(encodeWalletOperation(operation))
        const wireResult = overTheWire(encodeWalletOperationResult(result))

        expect(isWireWalletOperation(wireOperation)).toBe(true)
        expect(decodeWalletOperation(wireOperation)).toEqual(operation)
        expect(isWireWalletOperationResult(wireResult)).toBe(true)
        expect(decodeWalletOperationResult(wireResult)).toEqual(result)
    })

    it('rejects a switch-network operation with no network id', () => {
        expect(isWireWalletOperation({ type: 'switch-network' })).toBe(false)
        expect(
            isWireWalletOperation({ type: 'switch-network', networkId: 5 }),
        ).toBe(false)
    })

    it('rejects a message operation with no signer and a message result with no signature', () => {
        expect(
            isWireWalletOperation({
                type: 'sign-message',
                request: { method: 'personal_sign' },
            }),
        ).toBe(false)
        expect(isWireWalletOperationResult({ type: 'sign-typed-data' })).toBe(
            false,
        )
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

    it('accepts a decline flagged as a user rejection and refuses a non-boolean flag', () => {
        const withFlag = (isUserRejection: unknown) => ({
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'respond',
            connectionId: 'c1',
            correlationId: '7',
            outcome: { ok: false, message: 'declined', isUserRejection },
        })
        expect(isConnectionsControlMessage(withFlag(true))).toBe(true)
        expect(isConnectionsControlMessage(withFlag('yes'))).toBe(false)
    })

    it('accepts a decline carrying a known failure kind and refuses any other', () => {
        const withFailure = (failure: unknown) => ({
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'respond',
            connectionId: 'c1',
            correlationId: '7',
            outcome: { ok: false, message: 'Request failed', failure },
        })
        expect(isConnectionsControlMessage(withFailure('invalid-params'))).toBe(
            true,
        )
        expect(isConnectionsControlMessage(withFailure('made-up'))).toBe(false)
        expect(isConnectionsControlMessage(withFailure(4001))).toBe(false)
        // A decline travels only as `isUserRejection`, which clears the site's queue.
        expect(isConnectionsControlMessage(withFailure('user-rejected'))).toBe(
            false,
        )
    })

    it('accepts a well-formed submit-send and refuses one without correlationId or with malformed transactions', () => {
        const submitSend = (fields: Record<string, unknown>) => ({
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'submit-send',
            connectionId: 'c1',
            correlationId: '7',
            signedTransactions: [{ scope: SCOPE, id: '0xabc', bytes: 'AQID' }],
            ...fields,
        })

        expect(isConnectionsControlMessage(submitSend({}))).toBe(true)
        expect(
            isConnectionsControlMessage(
                submitSend({ correlationId: undefined }),
            ),
        ).toBe(false)
        expect(
            isConnectionsControlMessage(submitSend({ signedTransactions: [] })),
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
                    requested: {
                        networks: ['mainnet'],
                        chains: ['algorand'],
                        methods: [],
                    },
                    expiresAt: 1,
                },
            }),
        ).toBe(true)
    })

    it('refuses a connection-proposal whose chains are missing or unknown', () => {
        const proposal = {
            kind: 'connection-proposal',
            proposalId: 'p1',
            connectionKind: 'dapp-eip1193',
            peer: PEER,
            expiresAt: 1,
        }
        for (const chains of [undefined, ['solana'], 'ethereum']) {
            expect(
                isConnectionApprovalRequestMessage({
                    scope: CONNECTIONS_REQUEST_SCOPE,
                    request: {
                        ...proposal,
                        requested: {
                            networks: ['mainnet'],
                            chains,
                            methods: [],
                        },
                    },
                }),
            ).toBe(false)
        }
    })

    it('accepts a connection-request carrying a wire operation', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-request',
                    connectionId: 'c1',
                    correlationId: '9',
                    chainId: 'algorand',
                    operation: { type: 'sign-transactions', group: [] },
                    authorizedAccounts: ['AAAA'],
                    peer: PEER,
                    sourceType: 'injected',
                },
            }),
        ).toBe(true)
    })

    it('rejects a connection-request with no sourceType', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-request',
                    connectionId: 'c1',
                    correlationId: '9',
                    chainId: 'algorand',
                    operation: { type: 'sign-transactions', group: [] },
                    authorizedAccounts: ['AAAA'],
                    peer: PEER,
                },
            }),
        ).toBe(false)
    })

    it('rejects a connection-request with a missing or unknown chainId', () => {
        const base = {
            kind: 'connection-request' as const,
            connectionId: 'c1',
            correlationId: '9',
            operation: { type: 'sign-transactions' as const, group: [] },
            authorizedAccounts: ['AAAA'],
            peer: PEER,
            sourceType: 'injected' as const,
        }
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: base,
            }),
        ).toBe(false)
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: { ...base, chainId: 'not-a-real-chain' },
            }),
        ).toBe(false)
    })

    it('accepts a connection-request carrying a verifiedOrigin', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-request',
                    connectionId: 'c1',
                    correlationId: '9',
                    chainId: 'algorand',
                    operation: { type: 'sign-transactions', group: [] },
                    authorizedAccounts: ['AAAA'],
                    peer: PEER,
                    sourceType: 'injected',
                    verifiedOrigin: 'https://dapp.example',
                },
            }),
        ).toBe(true)
    })

    it('rejects a connection-request whose verifiedOrigin is not a string', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-request',
                    connectionId: 'c1',
                    correlationId: '9',
                    chainId: 'algorand',
                    operation: { type: 'sign-transactions', group: [] },
                    authorizedAccounts: ['AAAA'],
                    peer: PEER,
                    sourceType: 'injected',
                    verifiedOrigin: { host: 'dapp.example' },
                },
            }),
        ).toBe(false)
    })

    it('accepts a connection-request-withdrawn notice', () => {
        expect(
            isConnectionApprovalRequestMessage({
                scope: CONNECTIONS_REQUEST_SCOPE,
                request: {
                    kind: 'connection-request-withdrawn',
                    connectionId: 'c1',
                    correlationId: '9',
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
                        requested: {
                            networks: ['testnet'],
                            chains: ['algorand'],
                            methods: [],
                        },
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
