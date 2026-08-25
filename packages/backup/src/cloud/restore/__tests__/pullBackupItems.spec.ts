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

import { pullBackupItems, buildPulledAccounts } from '../pullBackupItems'
import { BackupAccountType } from '../../models'

const encKey = new Uint8Array(32).fill(7)
const backupId = 'did:pera:ADDR'
const enc = (key: string, plaintext: string) =>
    encryptItemPayload(plaintext, { encryptionKey: encKey, backupId, key })

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
            items: {},
        })
        fetchDelta.mockResolvedValue([
            {
                seq: 9,
                key: 'accounts/QADDR',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h1',
            },
            {
                seq: 10,
                key: 'secrets/QADDR',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h2',
            },
        ])
        readItems.mockResolvedValue([
            {
                key: 'accounts/QADDR',
                ver: 1,
                hash: 'h1',
                payload: enc(
                    'accounts/QADDR',
                    JSON.stringify({
                        type: 'quantum',
                        address: 'QADDR',
                        customName: 'Quantum',
                    }),
                ),
            },
            {
                key: 'secrets/QADDR',
                ver: 1,
                hash: 'h2',
                payload: enc(
                    'secrets/QADDR',
                    JSON.stringify({ type: 'quantum', mnemonic: 'a b c' }),
                ),
            },
        ])

        const result = await pullBackupItems({
            network: 'mainnet',
            backupId,
            deviceId: 'device-1',
            encryptionKey: encKey,
        })

        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0]).toMatchObject({
            address: 'QADDR',
            addressPayload: { type: 'quantum', address: 'QADDR' },
            secretsPayload: { type: 'quantum', mnemonic: 'a b c' },
        })
        expect(result.skipped).toHaveLength(0)
    })

    it('groups an algo25 account with its secret by address', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 10,
            items: {},
        })
        fetchDelta.mockResolvedValue([
            {
                seq: 9,
                key: 'accounts/ADDR',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h1',
            },
            {
                seq: 10,
                key: 'secrets/ADDR',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h2',
            },
        ])
        readItems.mockResolvedValue([
            {
                key: 'accounts/ADDR',
                ver: 1,
                hash: 'h1',
                payload: enc(
                    'accounts/ADDR',
                    JSON.stringify({
                        type: 'algo25',
                        address: 'ADDR',
                        customName: 'Main',
                    }),
                ),
            },
            {
                key: 'secrets/ADDR',
                ver: 1,
                hash: 'h2',
                payload: enc(
                    'secrets/ADDR',
                    JSON.stringify({ type: 'algo25', mnemonic: 'a b c' }),
                ),
            },
        ])

        const result = await pullBackupItems({
            network: 'mainnet',
            backupId,
            deviceId: 'device-1',
            encryptionKey: encKey,
        })

        expect(result.lastSeq).toBe(10)
        expect(result.backupGlobalHash).toBe('sha256:global')
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0]).toMatchObject({
            address: 'ADDR',
            addressPayload: { type: 'algo25', address: 'ADDR' },
            secretsPayload: { type: 'algo25', mnemonic: 'a b c' },
        })
        expect(result.skipped).toHaveLength(0)
    })

    it('skips (does not throw) an item that fails to decrypt', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: {},
        })
        fetchDelta.mockResolvedValue([
            {
                seq: 1,
                key: 'accounts/BAD',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h',
            },
        ])
        readItems.mockResolvedValue([
            { key: 'accounts/BAD', ver: 1, hash: 'h', payload: 'bm90LXZhbGlk' },
        ])

        const result = await pullBackupItems({
            network: 'mainnet',
            backupId,
            deviceId: 'device-1',
            encryptionKey: encKey,
        })
        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([
            { key: 'accounts/BAD', reason: 'decrypt' },
        ])
    })

    it('ignores DELETE deltas and IGNORED items (no read calls)', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 2,
            items: {},
        })
        fetchDelta.mockResolvedValue([
            {
                seq: 1,
                key: 'accounts/A',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'DELETE',
                hash: null,
            },
            {
                seq: 2,
                key: 'accounts/B',
                type: 'ACCOUNT',
                ver: 1,
                status: 'IGNORED',
                op: 'UPSERT',
                hash: 'h',
            },
        ])
        const result = await pullBackupItems({
            network: 'mainnet',
            backupId,
            deviceId: 'device-1',
            encryptionKey: encKey,
        })
        expect(readItems).not.toHaveBeenCalled()
        expect(result.accounts).toHaveLength(0)
    })

    it('skips an item whose JSON fails to parse', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: {},
        })
        fetchDelta.mockResolvedValue([
            {
                seq: 1,
                key: 'accounts/P',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h',
            },
        ])
        readItems.mockResolvedValue([
            {
                key: 'accounts/P',
                ver: 1,
                hash: 'h',
                payload: enc('accounts/P', '{not json'),
            },
        ])
        const result = await pullBackupItems({
            network: 'mainnet',
            backupId,
            deviceId: 'device-1',
            encryptionKey: encKey,
        })
        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([{ key: 'accounts/P', reason: 'parse' }])
    })

    it('skips an item with an unexpected key prefix returned by the server', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: {},
        })
        fetchDelta.mockResolvedValue([
            {
                seq: 1,
                key: 'accounts/A',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'h',
            },
        ])
        readItems.mockResolvedValue([
            { key: 'unknown/FOO', ver: 1, hash: 'h', payload: 'AAAA' },
        ])
        const result = await pullBackupItems({
            network: 'mainnet',
            backupId,
            deviceId: 'device-1',
            encryptionKey: encKey,
        })
        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([
            { key: 'unknown/FOO', reason: 'missing-address' },
        ])
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
            ['F', { type: 'hdSeed', seed: 's', entropy: 'e' } as never],
        ])
        const result = buildPulledAccounts(addr as never, sec as never)
        expect(result).toHaveLength(1)
        expect(result[0].addressPayload.type).toBe('hdWallet')
        expect(result[0].secretsPayload).toMatchObject({ type: 'hdSeed' })
    })

    it('synthesizes a standalone hdSeed entry for an orphan seed secret', () => {
        const addr = new Map<string, never>()
        const sec = new Map<string, never>([
            ['F', { type: 'hdSeed', seed: 's', entropy: 'e' } as never],
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
