/*
 Copyright 2022-2025 Pera Wallet, LDA
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

import { pullBackupItems } from '../pullBackupItems'

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

    it('groups an Algo25 account with its secret by address', async () => {
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
                        type: 'Algo25',
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
                    JSON.stringify({ type: 'Algo25', mnemonic: 'a b c' }),
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
            addressPayload: { type: 'Algo25', address: 'ADDR' },
            secretsPayload: { type: 'Algo25', mnemonic: 'a b c' },
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
