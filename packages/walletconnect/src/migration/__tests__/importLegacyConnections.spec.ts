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
import type { WalletConnectV1SessionKeyStore } from '../../v1/secrets'

// Backs the kms mock; only the default-store test reaches it.
const secrets = new Map<string, Uint8Array>()

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            secrets.set(id, new Uint8Array(bytes))
        },
    ),
    hasSecret: vi.fn((id: string) => secrets.has(id)),
    withSecret: vi.fn(async () => null),
    removeSecret: vi.fn(async () => {}),
    zeroBytes: vi.fn((bytes: Uint8Array) => bytes.fill(0)),
}))

// Spied, not replaced: the point is proving the importer reaches the one
// shared implementation rather than carrying its own.
vi.mock('../../shared/peer', { spy: true })

const { LEGACY_STORE_KEY, importLegacyConnections } =
    await import('../importLegacyConnections')
const { createConnectionStore } =
    await import('@perawallet/wallet-extension-connections')
const { toPeer } = await import('../../shared/peer')

// The injected store every other test uses; `commit` is a spy so a test can
// make it fail or lie.
const keys = new Map<string, string>()
const defaultCommit = async (clientId: string, key: string) => {
    if (!keys.has(clientId)) keys.set(clientId, key)
    return `wc1-session-key:${clientId}`
}
const commit = vi.fn(defaultCommit)
const sessionKeys: WalletConnectV1SessionKeyStore = {
    commit,
    has: clientId => keys.has(clientId),
    read: async clientId => keys.get(clientId) ?? null,
    remove: async clientId => void keys.delete(clientId),
}

/** A 64-hex v1 session key, distinct per leading character of `seed`. */
const hexKey = (seed: string) =>
    seed.charCodeAt(0).toString(16).padStart(2, '0').repeat(32)

const legacyBlob = (clientIds: string[]) =>
    JSON.stringify({
        state: {
            walletConnectConnections: clientIds.map(clientId => ({
                clientId,
                version: 1,
                bridge: 'https://b.example',
                session: {
                    key: hexKey(clientId),
                    accounts: ['AAAA'],
                    chainId: 416_001,
                    peerId: 'peer',
                    handshakeTopic: `topic-${clientId}`,
                    peerMeta: { name: 'Tinyman', url: 'https://tinyman.org' },
                },
                createdAt: '2026-01-01T00:00:00.000Z',
            })),
        },
        version: 1,
    })

const makeStorage = () => {
    const map = new Map<string, string>()
    return {
        map,
        trim: vi.fn(),
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
    }
}

describe('importLegacyConnections', () => {
    beforeEach(() => {
        secrets.clear()
        keys.clear()
        commit.mockReset()
        commit.mockImplementation(defaultCommit)
        vi.mocked(toPeer).mockClear()
    })

    it('is a no-op when there is no legacy blob', async () => {
        const storage = makeStorage()
        const store = createConnectionStore({ storage })

        expect(
            await importLegacyConnections({ storage, store, sessionKeys }),
        ).toEqual({
            imported: 0,
            skipped: 0,
        })
    })

    it('imports records and commits their session keys', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a', 'b']))
        const store = createConnectionStore({ storage })

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        expect(result).toEqual({ imported: 2, skipped: 0 })
        expect(commit).toHaveBeenCalledWith('a', hexKey('a'))
        expect(sessionKeys.has('a')).toBe(true)
        expect(await store.list()).toHaveLength(2)
    })

    it('commits to the keystore when no store is injected', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        const result = await importLegacyConnections({ storage, store })

        expect(result).toEqual({ imported: 1, skipped: 0 })
        expect(secrets.has('wc1-session-key:a')).toBe(true)
        expect(keys.size).toBe(0)
        expect(storage.getItem(LEGACY_STORE_KEY)).toBeNull()
    })

    it('keeps clientId as the connection id so transportId stays stable', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        expect((await store.list())[0].id).toBe('a')
    })

    it('carries the legacy last-active date rather than re-dating every record', async () => {
        // The settings list sorts on `lastActiveAt` and prints it, so dropping
        // it re-sorts an upgrading user's whole list into creation order under
        // a wrong date.
        const storage = makeStorage()
        const blob: { state: { walletConnectConnections: unknown[] } } =
            JSON.parse(legacyBlob(['a']))
        const record = blob.state.walletConnectConnections[0] as Record<
            string,
            unknown
        >
        record.lastActiveAt = '2026-03-04T05:06:07.000Z'
        storage.setItem(LEGACY_STORE_KEY, JSON.stringify(blob))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        const [connection] = await store.list()
        expect(connection.lastActiveAt).toBe(
            Date.parse('2026-03-04T05:06:07.000Z'),
        )
        expect(connection.createdAt).toBe(
            Date.parse('2026-01-01T00:00:00.000Z'),
        )
    })

    it('falls back to the creation date when the record has no last-active date', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        const [connection] = await store.list()
        expect(connection.lastActiveAt).toBe(connection.createdAt)
    })

    it('never writes the session key into the record', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        expect(JSON.stringify(await store.list())).not.toContain(hexKey('a'))
    })

    it('reads the peer through the shared toPeer', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        expect(toPeer).toHaveBeenCalledTimes(1)
        expect((await store.list())[0].peer).toEqual({
            name: 'Tinyman',
            url: 'https://tinyman.org',
        })
    })

    it('skips a record whose session key is not 64 hex characters', async () => {
        // The v1 client derives its AES key from this string; anything but
        // 32 bytes of hex can never decrypt a frame, so committing it to the
        // keystore would only preserve a session that cannot be revived.
        const storage = makeStorage()
        const blob = JSON.parse(legacyBlob(['a', 'b'])) as {
            state: { walletConnectConnections: { session: { key: string } }[] }
        }
        blob.state.walletConnectConnections[0].session.key = 'not-a-hex-key'
        storage.setItem(LEGACY_STORE_KEY, JSON.stringify(blob))
        const store = createConnectionStore({ storage })

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect((await store.list()).map(connection => connection.id)).toEqual([
            'b',
        ])
        expect(sessionKeys.has('a')).toBe(false)
        expect(storage.getItem(LEGACY_STORE_KEY)).toBeNull()
    })

    it('whitelists the stored permissions against the methods the wallet supports', async () => {
        const storage = makeStorage()
        const blob = JSON.parse(legacyBlob(['a'])) as {
            state: {
                walletConnectConnections: {
                    session: { permissions?: unknown }
                }[]
            }
        }
        blob.state.walletConnectConnections[0].session.permissions = [
            'algo_signTxn',
            'eth_sendTransaction',
            7,
        ]
        storage.setItem(LEGACY_STORE_KEY, JSON.stringify(blob))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        expect((await store.list())[0].metadata?.permissions).toEqual([
            'algo_signTxn',
        ])
    })

    it('leaves a record already in the store untouched on a resumed run', async () => {
        // Pass one wrote 'a'; the app then ran and updated it. A resumed run
        // must not clobber those writes with the blob's stale copy.
        const storage = makeStorage()
        const blob = JSON.parse(legacyBlob(['a', 'b'])) as {
            state: { dappOrigins?: unknown }
        }
        blob.state.dappOrigins = {
            a: { source: 'qr', createdAt: 1 },
        }
        storage.setItem(LEGACY_STORE_KEY, JSON.stringify(blob))
        const store = createConnectionStore({ storage })
        const origin = {
            source: 'external-browser' as const,
            browserName: 'safari',
        }
        await store.upsert({
            id: 'a',
            kind: 'walletconnect-v1',
            name: 'Tinyman',
            peer: { name: 'Tinyman' },
            accounts: ['AAAA'],
            secretRef: 'wc1-session-key:a',
            status: 'inactive',
            createdAt: 5,
            lastActiveAt: 999,
            origin,
            metadata: {
                bridge: 'https://b.example',
                handshakeTopic: 'topic-a',
                peerId: 'peer',
                chainId: 416_001,
            },
        })

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        expect(result).toEqual({ imported: 1, skipped: 1 })
        const a = (await store.list()).find(connection => connection.id === 'a')
        expect(a).toMatchObject({
            status: 'inactive',
            lastActiveAt: 999,
            origin,
        })
        // Its key still has to be in the keystore before the blob may go.
        expect(sessionKeys.has('a')).toBe(true)
        expect(storage.getItem(LEGACY_STORE_KEY)).toBeNull()
    })

    it('deletes the legacy blob and trims the append log', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        expect(storage.getItem(LEGACY_STORE_KEY)).toBeNull()
        expect(storage.trim).toHaveBeenCalled()
    })

    it('skips a record with no session key rather than aborting the run', async () => {
        const storage = makeStorage()
        storage.setItem(
            LEGACY_STORE_KEY,
            JSON.stringify({
                state: {
                    walletConnectConnections: [
                        { clientId: 'broken', session: {} },
                        JSON.parse(legacyBlob(['ok'])).state
                            .walletConnectConnections[0],
                    ],
                },
            }),
        )
        const store = createConnectionStore({ storage })

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        expect(result).toEqual({ imported: 1, skipped: 1 })
        // Blob deletion is gated on zero UNATTEMPTED records, not zero skips:
        // an unreconstructable record's key protects nothing.
        expect(storage.getItem(LEGACY_STORE_KEY)).toBeNull()
    })

    it('converges when re-run after a crash, without duplicating secrets', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a', 'b']))
        const store = createConnectionStore({ storage })

        // Simulate a crash after the first record: commit fails on the second.
        commit.mockImplementationOnce(defaultCommit)
        commit.mockImplementationOnce(async () => {
            throw new Error('process died')
        })
        await expect(
            importLegacyConnections({ storage, store, sessionKeys }),
        ).rejects.toThrow()

        // The blob survives the crash — this is the property that makes the
        // migration resumable rather than destructive.
        expect(storage.getItem(LEGACY_STORE_KEY)).not.toBeNull()

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        // 'a' landed in pass one and is left alone; only 'b' is imported now.
        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(keys.size).toBe(2)
        expect(await store.list()).toHaveLength(2)
    })

    // The handler's replay guard keys off `metadata.handshakeId`; without it
    // every bridge replay after a socket flap raises a spurious error.
    it('carries handshakeId across so the replay guard recognises the approved handshake', async () => {
        const storage = makeStorage()
        const blob = JSON.parse(legacyBlob(['a'])) as {
            state: {
                walletConnectConnections: {
                    session: { handshakeId?: number }
                }[]
            }
        }
        blob.state.walletConnectConnections[0].session.handshakeId = 42
        storage.setItem(LEGACY_STORE_KEY, JSON.stringify(blob))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        const [connection] = await store.list()
        expect(connection.metadata?.handshakeId).toBe(42)
    })

    // A truncated write or an older persist shape lands here; treating it as
    // "zero records" would destroy every session key in the blob unread.
    it('keeps the blob when its shape is not understood, rather than deleting it as empty', async () => {
        const storage = makeStorage()
        storage.setItem(
            LEGACY_STORE_KEY,
            JSON.stringify({ state: { somethingElse: true } }),
        )
        const store = createConnectionStore({ storage })

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        expect(result).toEqual({ imported: 0, skipped: 0 })
        expect(storage.getItem(LEGACY_STORE_KEY)).not.toBeNull()
        expect(storage.trim).not.toHaveBeenCalled()
    })

    it('does not strand later records behind one that fails on every run', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a', 'bad', 'c']))
        const store = createConnectionStore({ storage })

        commit.mockImplementation(async (clientId, key) => {
            if (clientId === 'bad') throw new Error('permanently broken')
            return defaultCommit(clientId, key)
        })

        await expect(
            importLegacyConnections({ storage, store, sessionKeys }),
        ).rejects.toThrow()

        const ids = (await store.list()).map(connection => connection.id)
        expect(ids).toEqual(expect.arrayContaining(['a', 'c']))
        expect(ids).not.toContain('bad')
        // The blob survives — 'bad' will be retried, forever if need be,
        // without ever losing 'a' and 'c'.
        expect(storage.getItem(LEGACY_STORE_KEY)).not.toBeNull()
    })

    it('withholds deletion when a committed secret fails post-loop verification', async () => {
        const storage = makeStorage()
        storage.setItem(LEGACY_STORE_KEY, legacyBlob(['a']))
        const store = createConnectionStore({ storage })

        // Commit "succeeds" but the key is not actually retrievable
        // afterwards — the defensive case the verification step exists for.
        commit.mockImplementationOnce(
            async clientId => `wc1-session-key:${clientId}`,
        )

        const result = await importLegacyConnections({
            storage,
            store,
            sessionKeys,
        })

        expect(result).toEqual({ imported: 1, skipped: 0 })
        expect(storage.getItem(LEGACY_STORE_KEY)).not.toBeNull()
        expect(storage.trim).not.toHaveBeenCalled()
    })

    // `dappOrigins` drives the "Return to the dApp" hand-off and dies with the blob otherwise.
    it('carries a matching dappOrigins entry onto the migrated record', async () => {
        const storage = makeStorage()
        const blob = JSON.parse(legacyBlob(['a', 'b'])) as {
            state: { dappOrigins?: unknown }
        }
        blob.state.dappOrigins = {
            a: {
                source: 'external-browser',
                browserName: 'safari',
                createdAt: 1_700_000_000_000,
            },
        }
        storage.setItem(LEGACY_STORE_KEY, JSON.stringify(blob))
        const store = createConnectionStore({ storage })

        await importLegacyConnections({ storage, store, sessionKeys })

        const connections = await store.list()
        const a = connections.find(connection => connection.id === 'a')
        const b = connections.find(connection => connection.id === 'b')
        expect(a?.origin).toEqual({
            source: 'external-browser',
            browserName: 'safari',
        })
        // No entry in `dappOrigins` for 'b' — it must still import cleanly,
        // just without an origin.
        expect(b?.origin).toBeUndefined()
    })
})
