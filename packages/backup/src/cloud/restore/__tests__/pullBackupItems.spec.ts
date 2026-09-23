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

// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { encryptItemPayload } from '../../crypto/itemPayload'

const fetchManifest = vi.fn()
const fetchDelta = vi.fn()
const readItems = vi.fn()
vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchManifest: (...a: unknown[]) => fetchManifest(...a),
    fetchDelta: (...a: unknown[]) => fetchDelta(...a),
    readItems: (...a: unknown[]) => readItems(...a),
}))

import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    accountItemKey,
    contactItemKey,
    secretsItemKey,
    BackupAccountType,
} from '../../models'
import { pullBackupItems, buildPulledAccounts } from '../pullBackupItems'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const accountKey = (address: string) => accountItemKey(hashAddress(address))
const secretsKey = (address: string) => secretsItemKey(hashAddress(address))
const contactKey = (address: string) => contactItemKey(hashAddress(address))

const encKey = new Uint8Array(32).fill(7)
const backupId = 'did:pera:ADDR'
const enc = (key: string, plaintext: string) =>
    encryptItemPayload(plaintext, { encryptionKey: encKey, backupId, key })

const item = (key: string, payload: unknown) => ({
    key,
    ver: 1,
    hash: `h-${key}`,
    payload: enc(key, JSON.stringify(payload)),
})

const active = (ver: number, hash: string, lastSeq: number) => ({
    type: 'ACCOUNT',
    ver,
    status: 'ACTIVE',
    hash,
    lastSeq,
})

const pull = () =>
    pullBackupItems({
        network: 'mainnet',
        backupId,
        deviceId: 'device-1',
        encryptionKey: encKey,
    })

describe('pullBackupItems', () => {
    beforeEach(() => {
        fetchManifest.mockReset()
        fetchDelta.mockReset()
        readItems.mockReset()
    })

    it('groups a quantum account with its secret by address', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 10,
            items: {
                [accountKey('QADDR')]: active(1, 'h1', 9),
                [secretsKey('QADDR')]: active(1, 'h2', 10),
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('QADDR'), {
                type: 'quantum',
                address: 'QADDR',
                customName: 'Quantum',
            }),
            item(secretsKey('QADDR'), {
                type: 'quantum',
                mnemonic: 'a b c',
                address: 'QADDR',
            }),
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0]).toMatchObject({
            address: 'QADDR',
            addressPayload: { type: 'quantum', address: 'QADDR' },
            secretsPayload: {
                type: 'quantum',
                mnemonic: 'a b c',
                address: 'QADDR',
            },
        })
        expect(result.skipped).toHaveLength(0)
    })

    it('joins an account and its secret although both keys are opaque hashes', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 10,
            items: {
                [accountKey('ADDR')]: active(1, 'h1', 9),
                [secretsKey('ADDR')]: active(1, 'h2', 10),
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('ADDR'), {
                type: 'algo25',
                address: 'ADDR',
                customName: 'Main',
            }),
            item(secretsKey('ADDR'), {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            }),
        ])

        const result = await pull()

        expect(accountKey('ADDR')).not.toContain('ADDR')
        expect(result.lastSeq).toBe(10)
        expect(result.backupGlobalHash).toBe('sha256:global')
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0]).toMatchObject({
            address: 'ADDR',
            addressPayload: { type: 'algo25', address: 'ADDR' },
            secretsPayload: {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            },
        })
        expect(result.skipped).toHaveLength(0)
    })

    // Retention prunes the changelog, and once it has, `from_seq=0` is rejected
    // like any other cursor behind the window — so a restore that read the
    // delta stream would fail permanently on exactly the busiest backups.
    it('reads the manifest alone, never the changelog', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('A')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([])

        await pull()

        expect(fetchDelta).not.toHaveBeenCalled()
        expect(readItems).toHaveBeenCalledWith(
            'mainnet',
            backupId,
            'device-1',
            [accountKey('A')],
        )
    })

    it('skips (does not throw) an item that fails to decrypt', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('BAD')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([
            {
                key: accountKey('BAD'),
                ver: 1,
                hash: 'h',
                payload: 'bm90LXZhbGlk',
            },
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([
            { key: accountKey('BAD'), reason: 'decrypt' },
        ])
        expect(result.addressByKey).toEqual({})
    })

    it('ignores IGNORED items (no read calls)', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 2,
            items: {
                [accountKey('B')]: {
                    type: 'ACCOUNT',
                    ver: 1,
                    status: 'IGNORED',
                    hash: 'h',
                    lastSeq: 2,
                },
            },
        })

        const result = await pull()

        expect(readItems).not.toHaveBeenCalled()
        expect(result.accounts).toHaveLength(0)
    })

    it('skips an item whose JSON fails to parse', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('P')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([
            {
                key: accountKey('P'),
                ver: 1,
                hash: 'h',
                payload: enc(accountKey('P'), '{not json'),
            },
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([
            { key: accountKey('P'), reason: 'parse' },
        ])
    })

    it('skips a payload that names no address', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('NAMELESS')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([
            item(accountKey('NAMELESS'), {
                type: 'algo25',
                address: '',
                customName: null,
            }),
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(0)
        expect(result.addressByKey).toEqual({})
        expect(result.skipped).toEqual([
            { key: accountKey('NAMELESS'), reason: 'missing-address' },
        ])
    })

    // The import path matches this address against the seeds the wallet already
    // holds; a hash matches nothing, and the restore then mints a second HD root
    // for a seed the user already has.
    it('restores an orphaned hdSeed under the address its payload names', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 3,
            items: { [secretsKey('FIRSTDERIVED')]: active(1, 'h', 3) },
        })
        readItems.mockResolvedValue([
            item(secretsKey('FIRSTDERIVED'), {
                type: 'hdSeed',
                seed: 'aa',
                entropy: 'bb',
                address: 'FIRSTDERIVED',
            }),
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].address).toBe('FIRSTDERIVED')
        expect(result.accounts[0].addressPayload).toEqual({
            type: BackupAccountType.hdSeed,
            address: 'FIRSTDERIVED',
        })
    })

    it('reports the address of every item it read', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 5,
            items: {
                [accountKey('ADDR')]: active(1, 'h1', 3),
                [secretsKey('ADDR')]: active(1, 'h2', 4),
                [contactKey('CADDR')]: {
                    type: 'CONTACT',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h3',
                    lastSeq: 5,
                },
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('ADDR'), {
                type: 'algo25',
                address: 'ADDR',
                customName: null,
            }),
            item(secretsKey('ADDR'), {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            }),
            item(contactKey('CADDR'), {
                address: 'CADDR',
                name: 'Alice',
                updatedAt: 7,
            }),
        ])

        const result = await pull()

        expect(result.addressByKey).toEqual({
            [accountKey('ADDR')]: 'ADDR',
            [secretsKey('ADDR')]: 'ADDR',
            [contactKey('CADDR')]: 'CADDR',
        })
    })

    // The restore is a contact's only way home: it seeds the sync state at the
    // manifest's seq, so no later delta ever mentions an item that was already
    // in the backup when this device joined.
    it('reads contacts, so a restore is not the last time they are reachable', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 4,
            items: {
                [contactKey('CADDR')]: {
                    type: 'CONTACT',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h1',
                    lastSeq: 3,
                },
                [contactKey('GONE')]: {
                    type: 'CONTACT',
                    ver: 2,
                    status: 'IGNORED',
                    hash: 'h2',
                    lastSeq: 4,
                },
            },
        })
        readItems.mockResolvedValue([
            item(contactKey('CADDR'), {
                address: 'CADDR',
                name: 'Alice',
                updatedAt: 7,
            }),
        ])

        const result = await pull()

        expect(readItems).toHaveBeenCalledWith(
            'mainnet',
            backupId,
            'device-1',
            [contactKey('CADDR')],
        )
        expect(result.contacts).toEqual([
            { address: 'CADDR', name: 'Alice', updatedAt: 7 },
        ])
        expect(result.skipped).toHaveLength(0)
    })

    it('skips an unreadable contact without sinking the pull', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 3,
            items: {
                [contactKey('CADDR')]: {
                    type: 'CONTACT',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h1',
                    lastSeq: 3,
                },
            },
        })
        readItems.mockResolvedValue([
            { key: contactKey('CADDR'), ver: 1, hash: 'h1', payload: 'AAAA' },
        ])

        const result = await pull()

        expect(result.contacts).toEqual([])
        expect(result.skipped).toEqual([
            { key: contactKey('CADDR'), reason: 'decrypt' },
        ])
    })
})

describe('pullBackupItems manifest pass-through', () => {
    beforeEach(() => {
        fetchManifest.mockReset()
        fetchDelta.mockReset()
        readItems.mockReset()
    })

    it('returns every key the manifest holds, not just the ones it read', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 4,
            items: {
                [accountKey('A')]: active(2, 'h1', 3),
                [accountKey('GONE')]: {
                    type: 'ACCOUNT',
                    ver: 5,
                    status: 'IGNORED',
                    hash: 'h2',
                    lastSeq: 4,
                },
            },
        })
        // Only the ACTIVE key is downloaded; the tombstone still has to be
        // tracked or the next push offers it to the server as brand new.
        readItems.mockResolvedValue([])

        const result = await pull()

        expect(readItems).toHaveBeenCalledWith(
            'mainnet',
            backupId,
            'device-1',
            [accountKey('A')],
        )
        expect(Object.keys(result.manifestItems)).toEqual([
            accountKey('A'),
            accountKey('GONE'),
        ])
        expect(result.manifestItems[accountKey('GONE')].ver).toBe(5)
    })
})

describe('buildPulledAccounts', () => {
    it('attaches a hdSeed secret to its matching hdWallet account', () => {
        const addr = new Map<string, never>([
            [
                'F',
                {
                    type: 'hdWallet',
                    address: 'F',
                    seedFirstDerivedAddress: 'F',
                    publicKey: 'p',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: null,
                } as never,
            ],
        ])
        const sec = new Map<string, never>([
            [
                'F',
                {
                    type: 'hdSeed',
                    seed: 's',
                    entropy: 'e',
                    address: 'F',
                } as never,
            ],
        ])
        const result = buildPulledAccounts(addr as never, sec as never)
        expect(result).toHaveLength(1)
        expect(result[0].addressPayload.type).toBe('hdWallet')
        expect(result[0].secretsPayload).toMatchObject({ type: 'hdSeed' })
    })

    it('synthesizes a standalone hdSeed entry for an orphan seed secret', () => {
        const addr = new Map<string, never>()
        const sec = new Map<string, never>([
            [
                'F',
                {
                    type: 'hdSeed',
                    seed: 's',
                    entropy: 'e',
                    address: 'F',
                } as never,
            ],
        ])
        const result = buildPulledAccounts(addr as never, sec as never)
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            address: 'F',
            addressPayload: { type: BackupAccountType.hdSeed, address: 'F' },
            secretsPayload: { type: 'hdSeed' },
        })
    })
})
