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

import { Networks, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import type { ConnectionHandler } from '../handler'
import {
    runHandlerContractTests,
    type HandlerContractPeer,
} from '../testing/handler-contract'

const ORIGIN_KIND = 'origin-identified'
// The page's own origin is the connection id: nothing is scanned or pasted,
// so where the page runs is the whole identity.
const PAGE = 'https://page.example'

/** What the live handler exposes to the fixture peer below. */
type PageSurface = {
    propose: () => void
    request: (connectionId: string) => void
}

const page: { live: Nullable<PageSurface> } = { live: null }
const unreachable = new Set<string>()

/**
 * The smallest handler with no URI at all — the shape an origin-identified
 * `'dapp'` kind takes, where the peer is known by where the page runs and
 * nothing is ever scanned or pasted. Its passing the contract is what proves
 * the suite, and the interface, do not assume URI pairing.
 */
const createOriginHandler = (): ConnectionHandler => {
    let store: Nullable<ConnectionStoreAPI> = null
    const approved = new Map<string, Connection>()

    return {
        kind: ORIGIN_KIND,
        initialize: async ctx => {
            store = ctx.store
            page.live = {
                // No `pair()` first: the page announces itself, so the
                // proposal carries no pairing id to correlate on.
                propose: () => {
                    ctx.onProposal({
                        kind: ORIGIN_KIND,
                        proposalId: `${PAGE}#1`,
                        peer: { name: 'Page dApp', url: PAGE },
                        requested: {
                            networks: [Networks.mainnet],
                            methods: ['algo_signTxn'],
                        },
                        expiresAt: Date.now() + 60_000,
                        approve: async accounts => {
                            const connection: Connection = {
                                id: PAGE,
                                kind: ORIGIN_KIND,
                                name: 'Page dApp',
                                peer: { name: 'Page dApp', url: PAGE },
                                accounts,
                                status: 'active',
                                createdAt: Date.now(),
                                lastActiveAt: Date.now(),
                            }
                            approved.set(connection.id, connection)
                            await ctx.store.upsert(connection)
                            return connection
                        },
                        reject: async () => {},
                    })
                },
                request: connectionId => {
                    const connection = approved.get(connectionId)
                    if (!connection) {
                        throw new Error(`no connection ${connectionId}`)
                    }
                    // A page can navigate away mid-request, so delivery is
                    // the same fallible send a socket makes.
                    const send = async (): Promise<void> => {
                        if (unreachable.has(connectionId)) {
                            throw new Error(`the page for ${PAGE} is gone`)
                        }
                    }
                    ctx.onMessage({
                        kind: 'request',
                        connectionId,
                        correlationId: '1',
                        authorizedAccounts: connection.accounts,
                        peer: connection.peer,
                        rawOperation: {
                            type: 'sign-transactions',
                            params: [{ txn: 'base64==' }],
                        },
                        respond: send,
                        reject: send,
                    })
                },
            }
        },
        teardown: async () => {
            store = null
            page.live = null
        },
        disconnect: async id => {
            approved.delete(id)
            await store?.remove(id)
        },
        disconnectAll: async () => {},
        restore: async () =>
            ((await store?.list()) ?? []).filter(
                (record: Connection) => record.kind === ORIGIN_KIND,
            ),
        matchesNetwork: () => true,
    }
}

/** Delegates to whichever handler instance the suite currently has live. */
const requireLive = (): PageSurface => {
    if (!page.live) throw new Error('the origin handler is not initialized')
    return page.live
}

const originPeer: HandlerContractPeer = {
    propose: () => requireLive().propose(),
    request: connectionId => requireLive().request(connectionId),
    setReachable: (connectionId, isReachable) => {
        if (isReachable) unreachable.delete(connectionId)
        else unreachable.add(connectionId)
    },
}

runHandlerContractTests(ORIGIN_KIND, createOriginHandler, {
    peer: originPeer,
})
