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
    ConnectionsError,
    waitForPairingOutcome,
    type ConnectionHandler,
    type ConnectionProposal,
} from '@perawallet/wallet-core-connections'
import {
    AppError,
    Networks,
    type Network,
} from '@perawallet/wallet-core-shared'
import type { Connection } from '@perawallet/wallet-extension-connections'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    broadcastConnectionsEvent,
    onConnectionsControlMessage,
    type ConnectionsControlHandler,
} from '../client'
import type { ConnectionsEvent } from '../protocol'
import { createRemoteConnectionRegistry } from '../remote-registry'

const WC_URI = 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00'
const NETWORKS = Object.values(Networks)

const CONNECTION: Connection = {
    id: 'topic',
    kind: 'walletconnect-v1',
    name: 'dApp',
    peer: { name: 'dApp', url: 'https://dapp.example' },
    accounts: ['AAAA'],
    status: 'active',
    createdAt: 1,
    lastActiveAt: 1,
}

const proposalEvent = (pairingId: string): ConnectionsEvent => ({
    kind: 'proposal',
    proposal: {
        kind: 'walletconnect-v1',
        proposalId: `proposal-${pairingId}`,
        pairingId,
        peer: { name: 'dApp' },
        requested: { networks: [NETWORKS[0]], methods: ['algo_signTxn'] },
        expiresAt: 1,
    },
})

// An un-initialized handler: only the pure descriptor surface is ever
// consulted by the remote registry, so `pair` records that it was NOT called.
const makeHandler = (): ConnectionHandler & {
    pair: ReturnType<typeof vi.fn>
} =>
    ({
        kind: 'walletconnect-v1',
        initialize: vi.fn(),
        teardown: vi.fn(),
        canHandleUri: (uri: string) => uri.startsWith('wc:'),
        pair: vi.fn(),
        describeUri: () => ({ topic: 'topic', version: '1' }),
        disconnect: vi.fn(),
        disconnectAll: vi.fn(),
        restore: vi.fn(),
        matchesNetwork: (_connection: Connection, network: Network) =>
            network === NETWORKS[0],
    }) as unknown as ConnectionHandler & { pair: ReturnType<typeof vi.fn> }

// Stands in for the offscreen host: records every control message and answers
// like `runOffscreenApp`'s registry listener would.
const installHost = (answers: Partial<Record<string, unknown>> = {}) => {
    const received: unknown[] = []
    const handler: ConnectionsControlHandler = message => {
        received.push(message)
        switch (message.kind) {
            case 'pair': {
                return {
                    ok: true,
                    result: answers.pair ?? { pairingId: 'pair-1' },
                }
            }
            case 'approve-proposal': {
                return { ok: true, result: { connection: CONNECTION } }
            }
            default: {
                return { ok: true }
            }
        }
    }
    onConnectionsControlMessage(handler)
    return received
}

describe('createRemoteConnectionRegistry', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    describe('local descriptors', () => {
        it('answers describeUri from the claiming handler without any message', () => {
            const received = installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })

            expect(registry.describeUri(WC_URI)).toEqual({
                topic: 'topic',
                version: '1',
            })
            expect(registry.describeUri('https://nope')).toEqual({})
            expect(received).toEqual([])
        })

        it('filters every network through the handler for networksFor', () => {
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })

            expect(registry.networksFor(CONNECTION)).toEqual([NETWORKS[0]])
            expect(
                registry.networksFor({ ...CONNECTION, kind: 'unknown-kind' }),
            ).toEqual([])
        })
    })

    describe('pair', () => {
        it('throws no-handler locally when nothing claims the URI', async () => {
            const received = installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })

            const attempt = registry.pair('https://nope')

            await expect(attempt).rejects.toBeInstanceOf(ConnectionsError)
            await expect(attempt).rejects.toMatchObject({ code: 'no-handler' })
            expect(received).toEqual([])
        })

        it('sends a pair control message and resolves with the host pairing id', async () => {
            const received = installHost({ pair: { pairingId: 'host-pair' } })
            const handler = makeHandler()
            const registry = createRemoteConnectionRegistry({
                handlers: [handler],
            })

            const pairingId = await registry.pair(WC_URI, {
                origin: { source: 'qr' },
            })

            expect(pairingId).toBe('host-pair')
            expect(received).toEqual([
                expect.objectContaining({
                    kind: 'pair',
                    uri: WC_URI,
                    origin: { source: 'qr' },
                }),
            ])
            expect(handler.pair).not.toHaveBeenCalled()
        })
    })

    describe('lifecycle commands', () => {
        it('routes abandonPairing, disconnect and disconnectAll to the host', async () => {
            const received = installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })

            registry.abandonPairing('pair-1')
            await registry.disconnect('topic')
            await registry.disconnectAll()

            expect(received).toEqual([
                expect.objectContaining({
                    kind: 'abandon-pairing',
                    pairingId: 'pair-1',
                }),
                expect.objectContaining({
                    kind: 'disconnect',
                    connectionId: 'topic',
                }),
                expect.objectContaining({ kind: 'disconnect-all' }),
            ])
        })
    })

    describe('proposals', () => {
        it('re-emits a broadcast proposal whose approve routes to the host and yields the connection', async () => {
            const received = installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })
            const seen: ConnectionProposal[] = []
            registry.subscribeToProposals(proposal => seen.push(proposal))

            await broadcastConnectionsEvent(proposalEvent('pair-1'))
            const connection = await seen[0].approve(['AAAA'])

            expect(seen[0]).toMatchObject({
                proposalId: 'proposal-pair-1',
                pairingId: 'pair-1',
            })
            expect(connection).toEqual(CONNECTION)
            expect(received).toContainEqual(
                expect.objectContaining({
                    kind: 'approve-proposal',
                    proposalId: 'proposal-pair-1',
                    accounts: ['AAAA'],
                }),
            )
        })

        it('routes reject with its reason to the host', async () => {
            const received = installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })
            const seen: ConnectionProposal[] = []
            registry.subscribeToProposals(proposal => seen.push(proposal))

            await broadcastConnectionsEvent(proposalEvent('pair-1'))
            await seen[0].reject('user')

            expect(received).toContainEqual(
                expect.objectContaining({
                    kind: 'reject-proposal',
                    proposalId: 'proposal-pair-1',
                    reason: 'user',
                }),
            )
        })

        it('keeps fanning out when one listener throws', async () => {
            installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })
            const second = vi.fn()
            registry.subscribeToProposals(() => {
                throw new Error('listener bug')
            })
            registry.subscribeToProposals(second)

            await broadcastConnectionsEvent(proposalEvent('pair-1'))

            expect(second).toHaveBeenCalledTimes(1)
        })
    })

    describe('errors', () => {
        it('rebuilds a keyed error as an AppError so resolveErrorCopy can translate it', async () => {
            installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })
            const listener = vi.fn()
            registry.subscribeToErrors(listener)

            await broadcastConnectionsEvent({
                kind: 'error',
                name: 'ConnectionsError',
                message: 'No connection handler accepts this URI',
                messageKey: 'errors.connections.no_handler',
                scope: { pairingId: 'pair-1' },
            })

            const [error, scope] = listener.mock.calls[0]
            expect(error).toBeInstanceOf(AppError)
            expect(error).toMatchObject({
                name: 'ConnectionsError',
                message: 'No connection handler accepts this URI',
                metadata: { messageKey: 'errors.connections.no_handler' },
            })
            expect(scope).toEqual({ pairingId: 'pair-1' })
        })

        it('rebuilds an unkeyed error as a plain Error carrying its name', async () => {
            installHost()
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })
            const listener = vi.fn()
            registry.subscribeToErrors(listener)

            await broadcastConnectionsEvent({
                kind: 'error',
                name: 'TypeError',
                message: 'socket closed',
            })

            const [error, scope] = listener.mock.calls[0]
            expect(error).toBeInstanceOf(Error)
            expect(error).not.toBeInstanceOf(AppError)
            expect(error.name).toBe('TypeError')
            expect(scope).toBeUndefined()
        })
    })

    describe('waitForPairingOutcome over the remote registry', () => {
        it('settles on the broadcast proposal for the pairing it started', async () => {
            installHost({ pair: { pairingId: 'mine' } })
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })

            const outcome = waitForPairingOutcome(
                registry,
                registry.pair(WC_URI),
                5000,
            )
            await broadcastConnectionsEvent(proposalEvent('someone-else'))
            await broadcastConnectionsEvent(proposalEvent('mine'))

            await expect(outcome).resolves.toEqual({ type: 'proposal' })
        })

        it('settles on a broadcast error scoped to the pairing', async () => {
            installHost({ pair: { pairingId: 'mine' } })
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })

            const outcome = waitForPairingOutcome(
                registry,
                registry.pair(WC_URI),
                5000,
            )
            await broadcastConnectionsEvent({
                kind: 'error',
                name: 'ConnectionsError',
                message: 'wrong network',
                scope: { pairingId: 'mine' },
            })

            await expect(outcome).resolves.toMatchObject({
                type: 'error',
                error: expect.objectContaining({ message: 'wrong network' }),
            })
        })
    })

    describe('event subscription lifecycle', () => {
        it('registers one chrome listener lazily and removes it after the last unsubscribe', () => {
            const registry = createRemoteConnectionRegistry({
                handlers: [makeHandler()],
            })
            expect(fake.messageListeners.size).toBe(0)

            const stopProposals = registry.subscribeToProposals(vi.fn())
            const stopErrors = registry.subscribeToErrors(vi.fn())
            expect(fake.messageListeners.size).toBe(1)

            stopProposals()
            expect(fake.messageListeners.size).toBe(1)
            stopErrors()
            expect(fake.messageListeners.size).toBe(0)
        })
    })
})
