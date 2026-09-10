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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LegacyWalletConnectV1Session } from '@perawallet/wallet-extension-platform'
import type { Connection } from '@perawallet/wallet-extension-connections'
import { createConnectionStore } from '@perawallet/wallet-extension-connections'
import { migrateWalletConnect } from '../migrateWalletConnect'

const { accountsState, commitSessionKey, connectionsStorage } = vi.hoisted(
    () => {
        const map = new Map<string, string>()
        const defaultSetItem = (k: string, v: string) => void map.set(k, v)
        return {
            accountsState: { accounts: [] as { address: string }[] },
            commitSessionKey: vi.fn(
                async (clientId: string) => `wc1-session-key:${clientId}`,
            ),
            connectionsStorage: {
                map,
                defaultSetItem,
                trim: vi.fn(),
                getItem: (k: string) => map.get(k) ?? null,
                setItem: defaultSetItem,
                removeItem: (k: string) => void map.delete(k),
            },
        }
    },
)

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => accountsState,
    },
}))

type WalletConnectModule =
    typeof import('@perawallet/wallet-core-walletconnect')

// Aliased to source in this package's vitest config; held in variables so
// they stay out of tsc's program, since the package exports no subpaths.
const { PEER_MODULE, CONNECTION_MODULE } = vi.hoisted(() => ({
    PEER_MODULE: '@perawallet/wallet-core-walletconnect/shared/peer',
    CONNECTION_MODULE: '@perawallet/wallet-core-walletconnect/v1/connection',
}))

// The barrel drags in RN-only deps that do not resolve here, so the constant
// is spelled out and the two pure helpers the migrator shares with the blob
// importer are loaded straight from source.
vi.mock('@perawallet/wallet-core-walletconnect', async () => {
    const peer: Pick<WalletConnectModule, 'toPeer'> = await import(
        /* @vite-ignore */ PEER_MODULE
    )
    const connection: Pick<WalletConnectModule, 'isWalletConnectV1Connection'> =
        await import(/* @vite-ignore */ CONNECTION_MODULE)
    return {
        commitSessionKey,
        ALL_PERMISSIONS: ['algo_getAccounts', 'algo_signTxn', 'algo_signData'],
        toPeer: peer.toPeer,
        isWalletConnectV1Connection: connection.isWalletConnectV1Connection,
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        connections: {
            store: createConnectionStore({ storage: connectionsStorage }),
        },
    }),
}))

const { getProvider } = await import('@perawallet/wallet-extension-provider')

const buildSession = (
    overrides: Partial<LegacyWalletConnectV1Session> = {},
): LegacyWalletConnectV1Session => ({
    id: '42',
    peerMeta: {
        name: 'Test dApp',
        url: 'https://example.com',
        icons: ['https://example.com/icon.png'],
        description: 'A dApp',
    },
    isConnected: true,
    isSubscribed: true,
    dateTimestampMs: 1_700_000_000_000,
    fallbackBrowserGroupResponse: null,
    connectedAccounts: ['CONNECTED_ADDR'],
    sessionMetaJson: JSON.stringify({
        bridge: 'https://bridge.walletconnect.org',
        key: 'handshake-key',
        topic: 'topic-1',
        version: '1',
    }),
    clientId: 'client-1',
    peerId: 'peer-1',
    handshakeId: 1_690_000_000_000_001,
    currentKey: 'current-key',
    approvedAccounts: ['APPROVED_ADDR'],
    chainId: 416_002,
    ...overrides,
})

const listConnections = (): Promise<Connection[]> =>
    getProvider().connections.store.list()

/** A stored v1 record as the handler writes it; a topic only counts as seen on one of these. */
const existingV1 = (id: string, handshakeTopic: string): Connection => ({
    id,
    kind: 'walletconnect-v1',
    name: 'Existing',
    peer: { name: 'Existing' },
    accounts: [],
    secretRef: `wc1-session-key:${id}`,
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
    metadata: {
        bridge: 'https://bridge.walletconnect.org',
        handshakeTopic,
        peerId: 'peer-existing',
        chainId: 416_002,
    },
})

describe('migrateWalletConnect', () => {
    beforeEach(() => {
        commitSessionKey.mockReset()
        commitSessionKey.mockImplementation(
            async (clientId: string) => `wc1-session-key:${clientId}`,
        )
        connectionsStorage.map.clear()
        connectionsStorage.trim.mockClear()
        connectionsStorage.setItem = connectionsStorage.defaultSetItem
        accountsState.accounts = [
            { address: 'APPROVED_ADDR' },
            { address: 'CONNECTED_ADDR' },
        ]
    })

    it('maps an Android-shaped session field-by-field, preferring currentKey and approvedAccounts', async () => {
        const result = await migrateWalletConnect([buildSession()])

        expect(result).toEqual({ imported: 1, skipped: 0 })
        const written = await listConnections()
        expect(written).toHaveLength(1)
        expect(written[0]).toEqual({
            id: 'client-1',
            kind: 'walletconnect-v1',
            name: 'Test dApp',
            peer: {
                name: 'Test dApp',
                url: 'https://example.com',
                icons: ['https://example.com/icon.png'],
                description: 'A dApp',
            },
            accounts: ['APPROVED_ADDR'],
            secretRef: 'wc1-session-key:client-1',
            status: 'active',
            createdAt: 1_700_000_000_000,
            lastActiveAt: 1_700_000_000_000,
            metadata: {
                bridge: 'https://bridge.walletconnect.org',
                handshakeTopic: 'topic-1',
                peerId: 'peer-1',
                chainId: 416_002,
                handshakeId: 1_690_000_000_000_001,
                permissions: [
                    'algo_getAccounts',
                    'algo_signTxn',
                    'algo_signData',
                ],
            },
        })
        expect(commitSessionKey).toHaveBeenCalledWith('client-1', 'current-key')
    })

    it('omits empty peer fields the way the blob importer does', async () => {
        await migrateWalletConnect([
            buildSession({
                peerMeta: {
                    name: ' Padded ',
                    url: '',
                    icons: [],
                    description: '',
                },
            }),
        ])

        const written = await listConnections()
        expect(written[0].peer).toEqual({ name: 'Padded', icons: [] })
        expect(written[0].name).toBe('Padded')
    })

    it('grants the full method set so the permissions panel is not blank', async () => {
        // The native export carries no per-session method list. Without a
        // fallback, a natively-migrated session shows an empty permissions
        // panel where a blob-migrated one shows a full one.
        await migrateWalletConnect([buildSession()])

        const written = await listConnections()
        expect(written[0].metadata?.permissions).toEqual([
            'algo_getAccounts',
            'algo_signTxn',
            'algo_signData',
        ])
    })

    it('maps an iOS-shaped session: handshake key fallback, handshakeId omitted', async () => {
        const result = await migrateWalletConnect([
            buildSession({
                currentKey: null,
                handshakeId: null,
            }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 0 })
        const written = await listConnections()
        expect(commitSessionKey).toHaveBeenCalledWith(
            'client-1',
            'handshake-key',
        )
        expect(written[0].metadata?.handshakeId).toBeUndefined()
    })

    it('preserves the legacy chainId', async () => {
        await migrateWalletConnect([buildSession({ chainId: 416_002 })])

        const written = await listConnections()
        expect(written[0].metadata?.chainId).toBe(416_002)
    })

    it('skips a session whose chainId is unknown rather than guessing the network', async () => {
        const result = await migrateWalletConnect([
            buildSession({ chainId: null }),
        ])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(await listConnections()).toHaveLength(0)
    })

    it('falls back to connectedAccounts when approvedAccounts is null or empty', async () => {
        await migrateWalletConnect([
            buildSession({ approvedAccounts: null }),
            buildSession({
                approvedAccounts: [],
                clientId: 'client-2',
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k2',
                    topic: 'topic-2',
                    version: '1',
                }),
            }),
        ])

        const written = await listConnections()
        expect(written[0].accounts).toEqual(['CONNECTED_ADDR'])
        expect(written[1].accounts).toEqual(['CONNECTED_ADDR'])
    })

    it('normalizes epoch-seconds dateTimestampMs to ms', async () => {
        await migrateWalletConnect([
            buildSession({ dateTimestampMs: 1_700_000_000 }),
        ])

        const written = await listConnections()
        expect(written[0].createdAt).toBe(1_700_000_000_000)
    })

    it.each([
        ['clientId', { clientId: null }],
        ['peerId', { peerId: null }],
        [
            'key',
            {
                currentKey: null,
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    topic: 'topic-1',
                    version: '1',
                }),
            },
        ],
        [
            'bridge',
            {
                sessionMetaJson: JSON.stringify({
                    key: 'k',
                    topic: 'topic-1',
                    version: '1',
                }),
            },
        ],
        [
            'topic',
            {
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k',
                    version: '1',
                }),
            },
        ],
        ['accounts', { approvedAccounts: null, connectedAccounts: [] }],
    ] as const)(
        'skips a session missing %s and writes nothing',
        async (_label, overrides) => {
            const result = await migrateWalletConnect([
                buildSession(
                    overrides as Partial<LegacyWalletConnectV1Session>,
                ),
            ])

            expect(result).toEqual({ imported: 0, skipped: 1 })
            expect(await listConnections()).toHaveLength(0)
        },
    )

    it('skips sessions already in the store by id or handshakeTopic', async () => {
        const store = getProvider().connections.store
        await store.upsert(existingV1('client-1', 'other'))
        await store.upsert(existingV1('other-client', 'topic-2'))

        const result = await migrateWalletConnect([
            buildSession(),
            buildSession({
                clientId: 'client-3',
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k',
                    topic: 'topic-2',
                    version: '1',
                }),
            }),
        ])

        expect(result).toEqual({ imported: 0, skipped: 2 })
        expect(await listConnections()).toHaveLength(2)
    })

    it('does not import the same session twice within one batch', async () => {
        const result = await migrateWalletConnect([
            buildSession(),
            buildSession(),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(await listConnections()).toHaveLength(1)
    })

    it('malformed sessionMetaJson skips that session without aborting the batch', async () => {
        const result = await migrateWalletConnect([
            buildSession({ sessionMetaJson: 'not-json{{' }),
            buildSession({
                clientId: 'client-2',
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k2',
                    topic: 'topic-2',
                    version: '1',
                }),
            }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(await listConnections()).toHaveLength(1)
    })

    it('appends imports alongside pre-existing connections', async () => {
        const store = getProvider().connections.store
        await store.upsert({
            id: 'pre-existing',
            kind: 'walletconnect-v1',
            name: 'Pre-existing',
            peer: { name: 'Pre-existing' },
            accounts: [],
            status: 'active',
            createdAt: 0,
            lastActiveAt: 0,
            metadata: { handshakeTopic: 'pre-topic' },
        })

        await migrateWalletConnect([buildSession()])

        const written = await listConnections()
        expect(written).toHaveLength(2)
        expect(written.map(c => c.id)).toEqual(
            expect.arrayContaining(['pre-existing', 'client-1']),
        )
    })

    it('skips a session whose account did not migrate', async () => {
        accountsState.accounts = []

        const result = await migrateWalletConnect([buildSession()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(await listConnections()).toHaveLength(0)
    })

    it('skips the un-migrated session but imports the migrated one', async () => {
        accountsState.accounts = [{ address: 'APPROVED_ADDR' }]

        const result = await migrateWalletConnect([
            buildSession({
                clientId: 'client-missing',
                approvedAccounts: ['NOT_MIGRATED_ADDR'],
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k',
                    topic: 'topic-missing',
                    version: '1',
                }),
            }),
            buildSession(),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        const written = await listConnections()
        expect(written).toHaveLength(1)
        expect(written[0].id).toBe('client-1')
    })

    it('returns zeros and writes nothing for an empty input', async () => {
        const result = await migrateWalletConnect([])

        expect(result).toEqual({ imported: 0, skipped: 0 })
        expect(await listConnections()).toHaveLength(0)
    })

    it('carries handshakeId across so the replay guard recognises the approved handshake', async () => {
        await migrateWalletConnect([buildSession({ handshakeId: 42 })])

        const written = await listConnections()
        expect(written[0].metadata?.handshakeId).toBe(42)
    })

    it('writes the session key to the keystore, never into the record', async () => {
        await migrateWalletConnect([buildSession({ currentKey: 'secret-key' })])

        const records = await listConnections()
        expect(JSON.stringify(records)).not.toContain('secret-key')
        expect(records[0].secretRef).toBe(`wc1-session-key:${records[0].id}`)
    })

    // A resolved call is stamped complete by the migration runner and never
    // retried, so a write failure folded into `skipped` loses the session.
    it('rejects rather than silently counting a genuine commitSessionKey failure as skipped', async () => {
        commitSessionKey.mockRejectedValueOnce(
            new Error('keystore write failed'),
        )

        await expect(migrateWalletConnect([buildSession()])).rejects.toThrow(
            'keystore write failed',
        )

        // Never written — safe for the next run to retry from scratch.
        expect(await listConnections()).toHaveLength(0)
    })

    it('rejects when store.upsert fails after the session key was already committed', async () => {
        connectionsStorage.setItem = vi.fn(() => {
            throw new Error('storage full')
        })

        await expect(migrateWalletConnect([buildSession()])).rejects.toThrow(
            'storage full',
        )

        // The key was committed before the write failed — proving the
        // record is genuinely at risk of being orphaned if this were
        // swallowed instead of rethrown.
        expect(commitSessionKey).toHaveBeenCalledWith('client-1', 'current-key')
    })

    it('keeps attempting the rest of the batch after one session fails, then rejects', async () => {
        commitSessionKey.mockImplementation(async (clientId: string) => {
            if (clientId === 'client-1') {
                throw new Error('boom')
            }
            return `wc1-session-key:${clientId}`
        })

        await expect(
            migrateWalletConnect([
                buildSession(),
                buildSession({
                    clientId: 'client-2',
                    sessionMetaJson: JSON.stringify({
                        bridge: 'https://bridge.walletconnect.org',
                        key: 'k2',
                        topic: 'topic-2',
                        version: '1',
                    }),
                }),
            ]),
        ).rejects.toThrow('boom')

        // 'client-2' was still attempted and written despite 'client-1'
        // failing first — one bad session must not strand the rest.
        const written = await listConnections()
        expect(written.map(c => c.id)).toEqual(['client-2'])
    })
})
