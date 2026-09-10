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

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    type Mock,
} from 'vitest'
import type { Network } from '@perawallet/wallet-core-shared'
import {
    CONNECTION_LATE_PAIRING_GRACE_MS,
    type ConnectionErrorScope,
    type ConnectionProposal,
    type ConnectionRegistry,
    type InboundMessage,
    type WalletOperation,
    type WalletOperationResult,
} from '@perawallet/wallet-core-connections'
import { WalletConnectInvalidNetworkError } from '@perawallet/wallet-core-walletconnect'
import {
    CONNECTIONS_CONTROL_SCOPE,
    type ConnectionApprovalRequest,
    type ConnectionsControlCommand,
    type ConnectionsEvent,
} from '@perawallet/wallet-extension-platform-chrome'
import { startConnectionsHost, type ConnectionsHost } from '../connectionsHost'

// The repo-wide unit setup stubs both packages down to a few hook exports;
// the host needs the real error classes, so this file opts back in.
vi.mock('@perawallet/wallet-core-walletconnect', async importOriginal =>
    importOriginal(),
)
vi.mock('@perawallet/wallet-core-shared', async importOriginal =>
    importOriginal(),
)

type InboundRequest = Extract<InboundMessage, { kind: 'request' }>

const makeFakeRegistry = () => {
    const proposalListeners = new Set<(p: ConnectionProposal) => void>()
    const messageListeners = new Set<(m: InboundMessage) => void>()
    const errorListeners = new Set<
        (e: Error, scope?: ConnectionErrorScope) => void
    >()
    const registry: ConnectionRegistry = {
        register: vi.fn(),
        initialize: vi.fn(async () => {}),
        teardown: vi.fn(async () => {}),
        pair: vi.fn(async () => 'pairing-1'),
        abandonPairing: vi.fn(),
        describeUri: vi.fn(() => ({})),
        networksFor: vi.fn(() => []),
        disconnect: vi.fn(async () => {}),
        disconnectAll: vi.fn(async () => {}),
        reportError: (error, scope) => {
            for (const listener of errorListeners) listener(error, scope)
        },
        subscribeToProposals: listener => {
            proposalListeners.add(listener)
            return () => void proposalListeners.delete(listener)
        },
        subscribeToMessages: listener => {
            messageListeners.add(listener)
            return () => void messageListeners.delete(listener)
        },
        subscribeToErrors: listener => {
            errorListeners.add(listener)
            return () => void errorListeners.delete(listener)
        },
    }
    return {
        registry,
        emitProposal: (proposal: ConnectionProposal) =>
            proposalListeners.forEach(listener => listener(proposal)),
        emitMessage: (message: InboundMessage) =>
            messageListeners.forEach(listener => listener(message)),
        emitError: (error: Error, scope?: ConnectionErrorScope) =>
            errorListeners.forEach(listener => listener(error, scope)),
    }
}

const makeProposal = (
    overrides: Partial<ConnectionProposal> = {},
): ConnectionProposal => ({
    kind: 'walletconnect-v1',
    proposalId: 'proposal-1',
    pairingId: 'pairing-1',
    peer: { name: 'Dapp', url: 'https://dapp.example' },
    requested: { networks: ['mainnet' as Network], methods: ['algo_signTxn'] },
    expiresAt: 1000,
    approve: vi.fn(async accounts => ({
        id: 'conn-1',
        kind: 'walletconnect-v1',
        name: 'Dapp',
        peer: { name: 'Dapp' },
        accounts,
        status: 'active' as const,
        createdAt: 1,
        lastActiveAt: 1,
    })),
    reject: vi.fn(async () => {}),
    ...overrides,
})

const SIGN_TXN: WalletOperation = {
    type: 'sign-transactions',
    group: [{ txn: 'dHhu' }],
}

const makeRequest = (
    overrides: Partial<InboundRequest> = {},
): InboundRequest => ({
    kind: 'request',
    connectionId: 'conn-1',
    correlationId: '7',
    authorizedAccounts: ['ADDR1'],
    peer: { name: 'Dapp' },
    operation: SIGN_TXN,
    respond: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
    ...overrides,
})

describe('startConnectionsHost', () => {
    let fake: ReturnType<typeof makeFakeRegistry>
    let host: ConnectionsHost
    let requestApproval: Mock<
        (request: ConnectionApprovalRequest) => Promise<void>
    >
    let broadcastEvent: Mock<(event: ConnectionsEvent) => Promise<void>>
    let reconnectAll: Mock<() => void>

    const control = (command: ConnectionsControlCommand) =>
        host.handleControlMessage({
            scope: CONNECTIONS_CONTROL_SCOPE,
            ...command,
        })

    beforeEach(() => {
        fake = makeFakeRegistry()
        requestApproval = vi.fn(async () => {})
        broadcastEvent = vi.fn(async () => {})
        reconnectAll = vi.fn()
        host = startConnectionsHost({
            registry: fake.registry,
            network: () => 'mainnet' as Network,
            knownAddresses: () => ['ADDR1', 'ADDR2'],
            requestApproval,
            broadcastEvent,
            reconnectAll,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('proposals', () => {
        it('requests an approval and broadcasts the summary when a proposal arrives', () => {
            const proposal = makeProposal()

            fake.emitProposal(proposal)

            expect(requestApproval).toHaveBeenCalledWith({
                kind: 'connection-proposal',
                proposalId: 'proposal-1',
                pairingId: 'pairing-1',
                connectionKind: 'walletconnect-v1',
                peer: proposal.peer,
                requested: proposal.requested,
                expiresAt: 1000,
                requesterOrigin: undefined,
            })
            const event = broadcastEvent.mock.calls[0]?.[0]
            expect(event).toEqual({
                kind: 'proposal',
                proposal: expect.objectContaining({ proposalId: 'proposal-1' }),
            })
            expect(event).not.toHaveProperty('proposal.approve')
            expect(event).not.toHaveProperty('proposal.reject')
        })

        it('approves with only the caller-chosen accounts the wallet actually holds', async () => {
            const proposal = makeProposal()
            fake.emitProposal(proposal)

            const response = await control({
                kind: 'approve-proposal',
                proposalId: 'proposal-1',
                accounts: ['ADDR2', 'NOT-MINE'],
            })

            expect(proposal.approve).toHaveBeenCalledWith(['ADDR2'])
            expect(response).toEqual({
                ok: true,
                result: {
                    connection: expect.objectContaining({
                        accounts: ['ADDR2'],
                    }),
                },
            })
        })

        it('rejects the proposal instead of approving when no account belongs to the wallet', async () => {
            const proposal = makeProposal()
            fake.emitProposal(proposal)

            const response = await control({
                kind: 'approve-proposal',
                proposalId: 'proposal-1',
                accounts: ['NOT-MINE'],
            })

            expect(proposal.approve).not.toHaveBeenCalled()
            expect(proposal.reject).toHaveBeenCalledTimes(1)
            expect(response).toEqual({
                ok: false,
                error: expect.stringContaining('belong'),
            })
        })

        it('rejects the proposal with the given reason', async () => {
            const proposal = makeProposal()
            fake.emitProposal(proposal)

            const response = await control({
                kind: 'reject-proposal',
                proposalId: 'proposal-1',
                reason: 'nope',
            })

            expect(proposal.reject).toHaveBeenCalledWith('nope')
            expect(response).toEqual({ ok: true })
        })

        it('forgets a proposal once answered, so a second decision is unknown', async () => {
            fake.emitProposal(makeProposal())
            await control({
                kind: 'reject-proposal',
                proposalId: 'proposal-1',
            })

            const response = await control({
                kind: 'approve-proposal',
                proposalId: 'proposal-1',
                accounts: ['ADDR1'],
            })

            expect(response).toEqual({
                ok: false,
                error: expect.stringContaining('proposal-1'),
            })
        })

        it('answers the peer itself when no approval surface will ever answer', async () => {
            requestApproval.mockRejectedValueOnce(new Error('not acknowledged'))
            const proposal = makeProposal()

            fake.emitProposal(proposal)

            await vi.waitFor(() => expect(proposal.reject).toHaveBeenCalled())
            const response = await control({
                kind: 'approve-proposal',
                proposalId: 'proposal-1',
                accounts: ['ADDR1'],
            })
            expect(response).toEqual(expect.objectContaining({ ok: false }))
        })

        it('reports a failed approve as { ok: false } rather than throwing', async () => {
            const proposal = makeProposal({
                approve: vi.fn(async () => {
                    throw new Error('socket closed')
                }),
            })
            fake.emitProposal(proposal)

            const response = await control({
                kind: 'approve-proposal',
                proposalId: 'proposal-1',
                accounts: ['ADDR1'],
            })

            expect(response).toEqual({ ok: false, error: 'socket closed' })
        })
    })

    describe('requests', () => {
        it('requests an approval carrying the wire-encoded operation', () => {
            const request = makeRequest({
                operation: {
                    type: 'sign-data',
                    payload: {
                        stdSigData: {
                            authenticatorData: new Uint8Array([1, 2, 3]),
                        },
                    },
                } as unknown as WalletOperation,
            })

            fake.emitMessage(request)

            expect(requestApproval).toHaveBeenCalledWith({
                kind: 'connection-request',
                connectionId: 'conn-1',
                correlationId: '7',
                operation: {
                    type: 'sign-data',
                    payload: { stdSigData: { authenticatorData: 'AQID' } },
                },
                authorizedAccounts: ['ADDR1'],
                peer: { name: 'Dapp' },
            })
        })

        it('ignores notifications', () => {
            fake.emitMessage({
                kind: 'notification',
                connectionId: 'conn-1',
                event: { type: 'session-expiring', expiresAt: 1 },
            })

            expect(requestApproval).not.toHaveBeenCalled()
        })

        it('delivers an approved result to the peer', async () => {
            const request = makeRequest()
            fake.emitMessage(request)

            const response = await control({
                kind: 'respond',
                connectionId: 'conn-1',
                correlationId: '7',
                outcome: {
                    ok: true,
                    result: { type: 'sign-transactions', signed: ['c3R4bg=='] },
                },
            })

            expect(request.respond).toHaveBeenCalledWith({
                type: 'sign-transactions',
                signed: ['c3R4bg=='],
            })
            expect(response).toEqual({ ok: true })
        })

        it('decodes a sign-data result back to bytes before delivering it', async () => {
            const request = makeRequest()
            fake.emitMessage(request)

            await control({
                kind: 'respond',
                connectionId: 'conn-1',
                correlationId: '7',
                outcome: {
                    ok: true,
                    result: { type: 'sign-data', signatures: ['AQID'] },
                },
            })

            expect(request.respond).toHaveBeenCalledWith({
                type: 'sign-data',
                signatures: [new Uint8Array([1, 2, 3])],
            })
        })

        it('delivers a decline to the peer as an error', async () => {
            const request = makeRequest()
            fake.emitMessage(request)

            const response = await control({
                kind: 'respond',
                connectionId: 'conn-1',
                correlationId: '7',
                outcome: { ok: false, message: 'Request declined' },
            })

            expect(request.reject).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Request declined' }),
            )
            expect(response).toEqual({ ok: true })
        })

        it('reports a failed delivery as { ok: false }', async () => {
            const request = makeRequest({
                respond: vi.fn(async () => {
                    throw new Error('dead socket')
                }),
            })
            fake.emitMessage(request)

            const response = await control({
                kind: 'respond',
                connectionId: 'conn-1',
                correlationId: '7',
                outcome: {
                    ok: true,
                    result: { type: 'sign-transactions', signed: [] },
                },
            })

            expect(response).toEqual({ ok: false, error: 'dead socket' })
        })

        it('keeps the request addressable after a failed delivery, so a retry lands', async () => {
            // `answerOnce` releases its guard when delivery fails, but a
            // request already dropped from the host's map has nothing left to
            // address — the retry answers "unknown request" instead.
            const respond = vi
                .fn<(result: WalletOperationResult) => Promise<void>>()
                .mockRejectedValueOnce(new Error('dead socket'))
                .mockResolvedValue(undefined)
            const request = makeRequest({ respond })
            fake.emitMessage(request)
            const send = {
                kind: 'respond' as const,
                connectionId: 'conn-1',
                correlationId: '7',
                outcome: {
                    ok: true as const,
                    result: {
                        type: 'sign-transactions' as const,
                        signed: ['c3R4bg=='],
                    },
                },
            }

            expect(await control(send)).toEqual({
                ok: false,
                error: 'dead socket',
            })

            expect(await control(send)).toEqual({ ok: true })
            expect(respond).toHaveBeenCalledTimes(2)
        })

        it('answers an unknown request id with { ok: false }', async () => {
            const response = await control({
                kind: 'respond',
                connectionId: 'conn-9',
                correlationId: '1',
                outcome: { ok: false, message: 'x' },
            })

            expect(response).toEqual({
                ok: false,
                error: expect.stringContaining('conn-9:1'),
            })
        })

        it('rejects the request itself when no approval surface will ever answer', async () => {
            requestApproval.mockRejectedValueOnce(new Error('not acknowledged'))
            const request = makeRequest()

            fake.emitMessage(request)

            await vi.waitFor(() => expect(request.reject).toHaveBeenCalled())
        })
    })

    describe('errors', () => {
        it('broadcasts every registry error with its message key and scope', () => {
            const scope = { connectionId: 'conn-1' }

            fake.emitError(new WalletConnectInvalidNetworkError(), scope)

            expect(broadcastEvent).toHaveBeenCalledWith({
                kind: 'error',
                message: expect.any(String),
                name: 'WalletConnectInvalidNetworkError',
                messageKey: 'errors.walletconnect.invalid_network_body',
                scope,
            })
        })

        it('broadcasts a plain Error without a message key', () => {
            fake.emitError(new Error('boom'))

            expect(broadcastEvent).toHaveBeenCalledWith({
                kind: 'error',
                message: 'boom',
                name: 'Error',
                messageKey: undefined,
                scope: undefined,
            })
        })

        it('opens a network-mismatch notice for a pairing-scoped invalid-network error', () => {
            fake.emitError(new WalletConnectInvalidNetworkError(), {
                pairingId: 'pairing-1',
            })

            expect(requestApproval).toHaveBeenCalledWith({
                kind: 'connection-error',
                reason: 'network-mismatch',
                pairingId: 'pairing-1',
                activeNetwork: 'mainnet',
            })
        })

        it('does not open a notice for an invalid-network error with no pairing', () => {
            fake.emitError(new WalletConnectInvalidNetworkError(), {
                connectionId: 'conn-1',
            })

            expect(requestApproval).not.toHaveBeenCalled()
        })

        it('keeps at most one notice open until the user dismisses it', async () => {
            let dismiss: () => void = () => {}
            requestApproval.mockReturnValueOnce(
                new Promise<void>(resolve => {
                    dismiss = resolve
                }),
            )

            fake.emitError(new WalletConnectInvalidNetworkError(), {
                pairingId: 'pairing-1',
            })
            fake.emitError(new WalletConnectInvalidNetworkError(), {
                pairingId: 'pairing-2',
            })
            expect(requestApproval).toHaveBeenCalledTimes(1)

            dismiss()
            await vi.waitFor(() => {
                fake.emitError(new WalletConnectInvalidNetworkError(), {
                    pairingId: 'pairing-3',
                })
                expect(requestApproval).toHaveBeenCalledTimes(2)
            })
        })

        it('drops a held proposal whose pairing failed, so it can no longer be approved', async () => {
            const proposal = makeProposal()
            fake.emitProposal(proposal)

            fake.emitError(new Error('peer went away'), {
                pairingId: 'pairing-1',
            })
            const response = await control({
                kind: 'approve-proposal',
                proposalId: 'proposal-1',
                accounts: ['ADDR1'],
            })

            expect(proposal.approve).not.toHaveBeenCalled()
            expect(response).toEqual(expect.objectContaining({ ok: false }))
        })
    })

    describe('pairing', () => {
        it('pairs through the registry and returns the pairing id', async () => {
            const response = await control({
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=k',
                origin: { source: 'qr' },
            })

            expect(fake.registry.pair).toHaveBeenCalledWith(
                'wc:topic@1?bridge=b&key=k',
                { origin: { source: 'qr' } },
            )
            expect(response).toEqual({
                ok: true,
                result: { pairingId: 'pairing-1' },
            })
        })

        it('stamps the requester origin onto the proposal for that pairing only', async () => {
            await control({
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=k',
                requesterOrigin: 'https://requester.example',
            })

            fake.emitProposal(makeProposal({ pairingId: 'pairing-1' }))
            fake.emitProposal(
                makeProposal({
                    proposalId: 'proposal-2',
                    pairingId: 'pairing-2',
                }),
            )

            expect(requestApproval).toHaveBeenCalledWith(
                expect.objectContaining({
                    proposalId: 'proposal-1',
                    requesterOrigin: 'https://requester.example',
                }),
            )
            expect(requestApproval).toHaveBeenCalledWith(
                expect.objectContaining({
                    proposalId: 'proposal-2',
                    requesterOrigin: undefined,
                }),
            )
        })

        it('forgets the requester origin once the late-pairing grace has passed', async () => {
            vi.useFakeTimers()
            await control({
                kind: 'pair',
                uri: 'wc:topic@1?bridge=b&key=k',
                requesterOrigin: 'https://requester.example',
            })

            await vi.advanceTimersByTimeAsync(CONNECTION_LATE_PAIRING_GRACE_MS)
            fake.emitProposal(makeProposal({ pairingId: 'pairing-1' }))

            expect(requestApproval).toHaveBeenCalledWith(
                expect.objectContaining({
                    proposalId: 'proposal-1',
                    requesterOrigin: undefined,
                }),
            )
        })

        it('reports a failed pair as { ok: false }', async () => {
            vi.mocked(fake.registry.pair).mockRejectedValueOnce(
                new Error('No connection handler accepts this URI'),
            )

            const response = await control({ kind: 'pair', uri: 'nope:' })

            expect(response).toEqual({
                ok: false,
                error: 'No connection handler accepts this URI',
            })
        })
    })

    describe('other control messages', () => {
        it('routes abandon-pairing, disconnect and disconnect-all to the registry', async () => {
            await control({ kind: 'abandon-pairing', pairingId: 'pairing-1' })
            await control({ kind: 'disconnect', connectionId: 'conn-1' })
            await control({ kind: 'disconnect-all' })

            expect(fake.registry.abandonPairing).toHaveBeenCalledWith(
                'pairing-1',
            )
            expect(fake.registry.disconnect).toHaveBeenCalledWith('conn-1')
            expect(fake.registry.disconnectAll).toHaveBeenCalledTimes(1)
        })

        it('sweeps sockets on reconnect-all', () => {
            expect(control({ kind: 'reconnect-all' })).toEqual({ ok: true })
            expect(reconnectAll).toHaveBeenCalledTimes(1)
        })

        it('returns null for a message on another scope or a malformed one', () => {
            expect(
                host.handleControlMessage({
                    scope: 'pera-db-control',
                    kind: 'ensure-offscreen',
                }),
            ).toBeNull()
            expect(
                host.handleControlMessage({
                    scope: CONNECTIONS_CONTROL_SCOPE,
                    kind: 'approve-proposal',
                    proposalId: 'p',
                    accounts: 'not-an-array',
                }),
            ).toBeNull()
            expect(host.handleControlMessage(undefined)).toBeNull()
        })
    })
})
