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

import { describe, expect, it, vi } from 'vitest'
import type {
    Connection,
    ConnectionOrigin,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import type { ConnectionHandler, ConnectionHandlerContext } from '../handler'
import type {
    ConnectionProposal,
    InboundMessage,
    WalletOperationResult,
} from '../models'
import { createConnectionRegistry } from '../registry'

/**
 * The peer's side of a pairing, so the suite can drive a handler without
 * knowing its wire format. Delivery may be async; the suite yields a macrotask after each call.
 */
export interface HandlerContractPeer {
    /** No id for a handler without URI pairing, whose proposals have no `pair()` to correlate to. */
    propose(pairingId?: string): void
    /** Send a sign-transactions request the handler will accept. */
    request(connectionId: string): void
    /** Whether an answer can currently reach the peer on this connection. */
    setReachable(connectionId: string, isReachable: boolean): void
}

/** Supplied only by a handler that pairs from a URI. */
export interface HandlerContractUriFixtures {
    /** A pairing URI this handler must claim. */
    valid: string
    /** A pairing URI belonging to another protocol; must be declined. */
    foreign: string
    /** The secret substring in `valid` that must never be logged. */
    secret: string
}

export interface HandlerContractFixtures {
    /** Present exactly when the handler declares `canHandleUri`/`pair`; the URI cases are skipped without it. */
    uri?: HandlerContractUriFixtures
    /** Accounts to approve a proposal for; defaults to one placeholder. */
    accounts?: string[]
    /**
     * Enables the registry round-trip cases. Independent of `uri`: a
     * proposal-only handler runs them too, minus the origin cases.
     */
    peer?: HandlerContractPeer
}

type UriPairingHandler = ConnectionHandler &
    Required<Pick<ConnectionHandler, 'canHandleUri' | 'pair' | 'describeUri'>>

const hasUriPairing = (
    handler: ConnectionHandler,
): handler is UriPairingHandler =>
    handler.canHandleUri !== undefined &&
    handler.pair !== undefined &&
    handler.describeUri !== undefined

const SIGNED: WalletOperationResult = {
    type: 'sign-transactions',
    signed: ['c2ln'],
}

const ORIGIN: ConnectionOrigin = {
    source: 'external-browser',
    browserName: 'safari',
}

const flush = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0))

/**
 * Seedable because the persisted store is not kind-scoped, so a spec can prove
 * a handler filters to its own `kind` rather than merely surviving an empty list.
 */
export const memoryStore = (seed: Connection[] = []): ConnectionStoreAPI => {
    let items = [...seed]
    return {
        list: async () => [...items],
        get: async id => items.find(c => c.id === id),
        upsert: async c =>
            void (items = [...items.filter(i => i.id !== c.id), c]),
        remove: async id => void (items = items.filter(i => i.id !== id)),
        clear: async () => void (items = []),
        subscribe: () => () => {},
    }
}

const noopContext = (seed: Connection[] = []): ConnectionHandlerContext => ({
    store: memoryStore(seed),
    onProposal: vi.fn(),
    onMessage: vi.fn(),
    onDisconnected: vi.fn(),
    onError: vi.fn(),
})

/**
 * Run from each handler's own spec. A handler with no URI runs it without `uri`
 * fixtures and must pass; that is what keeps the interface from being WalletConnect-shaped.
 */
export const runHandlerContractTests = (
    name: string,
    makeHandler: () => ConnectionHandler,
    fixtures: HandlerContractFixtures,
): void => {
    describe(`${name} — ConnectionHandler contract`, () => {
        const { uri, peer } = fixtures

        it('declares a non-empty kind', () => {
            expect(makeHandler().kind).toBeTruthy()
        })

        // Intrinsic, not against the fixtures: `pair` routes on `canHandleUri`
        // and every error-level log goes through `describeUri`.
        it('declares canHandleUri, pair and describeUri together or not at all', () => {
            const handler = makeHandler()
            const declared = [
                handler.canHandleUri,
                handler.pair,
                handler.describeUri,
            ].filter(member => member !== undefined)

            expect([0, 3]).toContain(declared.length)
        })

        it('declares URI pairing (canHandleUri, pair, describeUri) exactly when the suite is given URI fixtures', () => {
            expect(hasUriPairing(makeHandler())).toBe(uri !== undefined)
        })

        it('only declares abandonPairing alongside pair', () => {
            const handler = makeHandler()

            expect(
                handler.abandonPairing === undefined ||
                    handler.pair !== undefined,
            ).toBe(true)
        })

        it('initialize then teardown is safe and repeatable', async () => {
            const handler = makeHandler()

            await handler.initialize(noopContext())
            await expect(handler.teardown()).resolves.toBeUndefined()
            await handler.initialize(noopContext())
            await expect(handler.teardown()).resolves.toBeUndefined()
        })

        // The registry produces this: `bootHandler` swallows a rejecting
        // `initialize` and `teardown()` still runs over every handler.
        it('teardown without initialize resolves', async () => {
            await expect(makeHandler().teardown()).resolves.toBeUndefined()
        })

        it('restore returns only records of its own kind', async () => {
            const handler = makeHandler()
            const foreign: Connection = {
                id: 'contract-suite-foreign-record',
                kind: `not-${handler.kind}`,
                name: 'Foreign',
                peer: { name: 'Foreign' },
                accounts: [],
                status: 'active',
                createdAt: 0,
                lastActiveAt: 0,
            }
            await handler.initialize(noopContext([foreign]))

            const restored = await handler.restore()

            expect(restored.some(c => c.id === foreign.id)).toBe(false)
            expect(restored.every(c => c.kind === handler.kind)).toBe(true)
            await handler.teardown()
        })

        it('disconnectAll resolves even with no connections', async () => {
            const handler = makeHandler()
            await handler.initialize(noopContext())

            await expect(handler.disconnectAll()).resolves.toBeUndefined()
            await handler.teardown()
        })

        describe.skipIf(!uri)('URI pairing', () => {
            const requireUri = (): HandlerContractUriFixtures => {
                if (!uri) throw new Error('fixtures.uri is required')
                return uri
            }
            const uriHandler = (): UriPairingHandler => {
                const handler = makeHandler()
                if (!hasUriPairing(handler)) {
                    throw new Error(`${name} declares no URI pairing`)
                }
                return handler
            }

            it('claims its own URI', () => {
                expect(uriHandler().canHandleUri(requireUri().valid)).toBe(true)
            })

            it('declines another protocol URI', () => {
                expect(uriHandler().canHandleUri(requireUri().foreign)).toBe(
                    false,
                )
            })

            it('declines a scheme-only signal with no pairing payload', () => {
                expect(uriHandler().canHandleUri('wc://?browser=safari')).toBe(
                    false,
                )
            })

            it('never leaks the pairing secret through describeUri', () => {
                const described = JSON.stringify(
                    uriHandler().describeUri(requireUri().valid),
                )

                expect(described).not.toContain(requireUri().secret)
            })

            it('rejects a URI it does not claim rather than resolving silently', async () => {
                await expect(
                    uriHandler().pair(requireUri().foreign),
                ).rejects.toThrow()
            })
        })

        describe.skipIf(!peer)('through the registry', () => {
            const requirePeer = (): HandlerContractPeer => {
                if (!peer) throw new Error('fixtures.peer is required')
                return peer
            }
            const requireUri = (): HandlerContractUriFixtures => {
                if (!uri) throw new Error('fixtures.uri is required')
                return uri
            }

            // A proposal-only handler has no pairing to correlate, which is why
            // `propose` takes no id there.
            const approveOne = async (origin?: ConnectionOrigin) => {
                const store = memoryStore()
                const handler = makeHandler()
                const registry = createConnectionRegistry({ store })
                registry.register(handler)
                let proposal: ConnectionProposal | undefined
                registry.subscribeToProposals(next => {
                    proposal = next
                })
                const messages: InboundMessage[] = []
                registry.subscribeToMessages(message => {
                    messages.push(message)
                })
                await registry.initialize()

                const pairingId = uri
                    ? await registry.pair(
                          uri.valid,
                          origin ? { origin } : undefined,
                      )
                    : undefined
                requirePeer().propose(pairingId)
                await flush()
                if (!proposal)
                    throw new Error('the peer proposal never arrived')
                const connection = await proposal.approve(
                    fixtures.accounts ?? ['AAAA'],
                )

                const requestOne = async () => {
                    requirePeer().request(connection.id)
                    await flush()
                    const message = messages.at(-1)
                    if (message?.kind !== 'request') {
                        throw new Error('the peer request never arrived')
                    }
                    return message
                }

                return { store, handler, registry, connection, requestOne }
            }

            it('an approved connection round-trips through restore, with the origin pair carried', async () => {
                const { handler, registry, connection } =
                    await approveOne(ORIGIN)

                const restored = await handler.restore()

                const match = restored.find(c => c.id === connection.id)
                expect(match).toBeDefined()
                // Only a URI pairing can carry an origin in, via `pair(uri, opts)`.
                expect(match?.origin).toEqual(uri ? ORIGIN : undefined)
                await registry.teardown()
            })

            it.skipIf(!uri)(
                'writes the origin handed to pair onto the approved record',
                async () => {
                    const { store, registry, connection } =
                        await approveOne(ORIGIN)

                    expect(connection.origin).toEqual(ORIGIN)
                    expect((await store.get(connection.id))?.origin).toEqual(
                        ORIGIN,
                    )
                    await registry.teardown()
                },
            )

            it('records no origin when pair was given none', async () => {
                const { registry, connection } = await approveOne()

                expect(connection.origin).toBeUndefined()
                await registry.teardown()
            })

            it('disconnect removes the connection from the store', async () => {
                const { store, registry, connection } = await approveOne()
                expect(await store.get(connection.id)).toBeTruthy()

                await registry.disconnect(connection.id)

                expect(await store.get(connection.id)).toBeUndefined()
                await registry.teardown()
            })

            it('answers a request exactly once', async () => {
                const { registry, requestOne } = await approveOne()
                const message = await requestOne()

                await message.respond(SIGNED)

                await expect(message.respond(SIGNED)).rejects.toMatchObject({
                    code: 'already-answered',
                })
                await expect(
                    message.reject(new Error('too late')),
                ).rejects.toMatchObject({ code: 'already-answered' })
                await registry.teardown()
            })

            it('a respond the peer never received stays answerable', async () => {
                const { registry, connection, requestOne } = await approveOne()
                const message = await requestOne()

                requirePeer().setReachable(connection.id, false)
                await expect(message.respond(SIGNED)).rejects.toThrow()

                requirePeer().setReachable(connection.id, true)
                await expect(message.respond(SIGNED)).resolves.toBeUndefined()
                await registry.teardown()
            })

            it.skipIf(!uri || makeHandler().abandonPairing === undefined)(
                'an abandoned pairing never proposes',
                async () => {
                    const store = memoryStore()
                    const registry = createConnectionRegistry({ store })
                    registry.register(makeHandler())
                    const onProposal = vi.fn()
                    registry.subscribeToProposals(onProposal)
                    await registry.initialize()
                    const pairingId = await registry.pair(requireUri().valid)

                    registry.abandonPairing(pairingId)
                    requirePeer().propose(pairingId)
                    await flush()

                    expect(onProposal).not.toHaveBeenCalled()
                    await registry.teardown()
                },
            )
        })
    })
}
