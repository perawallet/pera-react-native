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
import { describe, expect, it, vi } from 'vitest'
import {
    BackupAccountType,
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
} from '../../models'
import { UpsertResult } from '../../api'
import { decryptItemPayload } from '../../crypto/itemPayload'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { passkeyItemKey } from '../../models'
import { buildLocalPasskeyItems } from '../buildLocalPasskeyItems'
import { pushDirty } from '../pushDirty'
import { reconcileSettings } from '../reconcileSettings'
import { BackupPushIncompleteError, BackupSyncAbortedError } from '../types'
import type { LocalItem } from '../types'
import { TEST_SETTINGS } from './testSettings'

const encryptionKey = new Uint8Array(32).fill(7)
/** `key` is an opaque hash, as in production, so the address is declared. */
const item = (key: string, address: string): LocalItem => ({
    key,
    type: BackupItemType.ACCOUNT,
    contentHash: 'h',
    address,
    accountType: BackupAccountType.watch,
    payload: {
        type: 'watch',
        address,
        updatedAt: 0,
    } as never,
})
const baseDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey,
    batchUpsertItems: vi.fn(),
    deleteItem: vi.fn(async () => ({ seq: 99 })),
    isAborted: () => false,
})

const dirtyState = (count: number) => {
    const state = createEmptySyncState('b')
    const localItems: LocalItem[] = []
    for (let i = 0; i < count; i++) {
        state.items[`accounts/${i}`] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 0,
            baseVer: 0,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: null,
            localContentHash: 'h',
            localUpdatedAt: 1,
        }
        localItems.push(item(`accounts/${i}`, `ADDR${i}`))
    }
    return { state, localItems }
}

const acceptAll = async (
    _network: unknown,
    _backupId: unknown,
    _deviceId: unknown,
    request: { items: { key: string }[] },
) => ({
    results: request.items.map((entry, i) => ({
        key: entry.key,
        result: UpsertResult.OK,
        new_ver: 1,
        seq: i + 1,
    })),
})

describe('pushDirty', () => {
    it('uploads a large backlog in bounded batches', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockImplementation(acceptAll)
        const { state, localItems } = dirtyState(60)

        const next = await pushDirty({ state, localItems, deps })

        const sizes = deps.batchUpsertItems.mock.calls.map(
            call => (call[3] as { items: unknown[] }).items.length,
        )
        expect(sizes).toEqual([25, 25, 10])
        expect(Object.values(next.items).every(i => !i.isDirty)).toBe(true)
    })

    it("holds the cursor below another device's write that landed between batches", async () => {
        const deps = baseDeps()
        // seq 26 went to another device between our two batches.
        deps.batchUpsertItems
            .mockImplementationOnce(acceptAll)
            .mockImplementationOnce(
                async (...args: Parameters<typeof acceptAll>) => {
                    const response = await acceptAll(...args)
                    return {
                        results: response.results.map(r => ({
                            ...r,
                            seq: r.seq + 26,
                        })),
                    }
                },
            )
        const { state, localItems } = dirtyState(30)

        const next = await pushDirty({ state, localItems, deps })

        expect(next.lastSyncedSeq).toBe(25)
        expect(Object.values(next.items).every(i => !i.isDirty)).toBe(true)
    })

    it('carries the batches that landed when a later one fails', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems
            .mockImplementationOnce(acceptAll)
            .mockRejectedValueOnce(new Error('timeout'))
        const { state, localItems } = dirtyState(60)

        const error = await pushDirty({ state, localItems, deps }).catch(
            (e: unknown) => e,
        )

        expect(error).toBeInstanceOf(BackupPushIncompleteError)
        const partial = (error as BackupPushIncompleteError).state
        const landed = Object.values(partial.items).filter(i => !i.isDirty)
        expect(landed).toHaveLength(25)
        expect(landed.every(i => i.baseVer === 1)).toBe(true)
        expect(deps.batchUpsertItems).toHaveBeenCalledTimes(2)
    })

    it('pushes dirty items and on OK clears dirty + advances ver/seq', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: 'accounts/A',
                    result: UpsertResult.OK,
                    new_ver: 8,
                    seq: 51,
                },
            ],
        })
        const state = { ...createEmptySyncState('b'), lastSyncedSeq: 50 }
        state.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 7,
            baseVer: 7,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 200,
        }
        const next = await pushDirty({
            state,
            localItems: [item('accounts/A', 'A')],
            deps,
        })
        expect(deps.batchUpsertItems).toHaveBeenCalledTimes(1)
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: false,
            knownVer: 8,
            baseVer: 8,
        })
        expect(next.lastSyncedSeq).toBe(51)
    })

    it('on VERSION_CONFLICT leaves the item dirty for the next sync', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: 'accounts/A',
                    result: UpsertResult.VERSION_CONFLICT,
                    current_ver: 9,
                    current_hash: 'rh',
                },
            ],
        })
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 7,
            baseVer: 7,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 200,
        }
        const next = await pushDirty({
            state,
            localItems: [item('accounts/A', 'A')],
            deps,
        })
        // Stays dirty, records the server's current_ver, but DELIBERATELY keeps
        // lastRemoteHash STALE ('r', not the conflict's 'rh'). The stale hash is
        // what makes the next sync's applyDeltas re-download this item and run
        // last-write-wins; advancing it here would livelock the conflict.
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: true,
            knownVer: 9,
            lastRemoteHash: 'r',
        })
    })

    it('processes pending-delete keys via deleteItem and tombstones them', async () => {
        const deps = baseDeps()
        const state = createEmptySyncState('b')
        state.items['accounts/GONE'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            pendingDelete: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 1,
        }
        const next = await pushDirty({ state, localItems: [], deps })
        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'b',
            'dev',
            'accounts/GONE',
        )
        expect(next.items['accounts/GONE']).toMatchObject({
            status: BackupItemStatus.IGNORED,
            isDirty: false,
            pendingDelete: false,
            localContentHash: null,
        })
    })

    it('does not upload when a stop lands while a deletion is in flight', async () => {
        let stopped = false
        const deps = {
            ...baseDeps(),
            deleteItem: vi.fn(async () => {
                stopped = true
                return { seq: 99 }
            }),
            isAborted: () => stopped,
        }
        const state = createEmptySyncState('b')
        state.items['accounts/GONE'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            pendingDelete: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 1,
        }
        state.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 1,
        }

        await expect(
            pushDirty({
                state,
                localItems: [item('accounts/A')],
                deps,
            }),
        ).rejects.toThrow(BackupSyncAbortedError)

        expect(deps.batchUpsertItems).not.toHaveBeenCalled()
    })

    it('injects the last-write-wins timestamp into a contact payload', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({ results: [] })
        const state = createEmptySyncState('b')
        state.items['contacts/C1'] = {
            type: BackupItemType.CONTACT,
            knownVer: 1,
            baseVer: 1,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: null,
            localContentHash: 'h',
            localUpdatedAt: 777,
        }

        await pushDirty({
            state,
            localItems: [
                {
                    key: 'contacts/C1',
                    type: BackupItemType.CONTACT,
                    contentHash: 'h',
                    address: 'C1',
                    accountType: null,
                    payload: { address: 'C1', name: 'Alice' },
                },
            ],
            deps,
        })

        const [, , , request] = deps.batchUpsertItems.mock.calls[0]
        const plaintext = decryptItemPayload(request.items[0].payload, {
            encryptionKey,
            backupId: 'b',
            key: 'contacts/C1',
        })
        expect(JSON.parse(plaintext)).toEqual({
            address: 'C1',
            name: 'Alice',
            updatedAt: 777,
        })
    })

    it('injects the last-write-wins timestamp into a passkey payload', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({ results: [] })
        const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
        const key = passkeyItemKey(hashAddress('Y3JlZC1pZA=='))
        const state = createEmptySyncState('b')
        state.items[key] = {
            type: BackupItemType.PASSKEY,
            knownVer: 1,
            baseVer: 1,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: null,
            localContentHash: 'h',
            localUpdatedAt: 1_700_000_000,
        }
        const localItems = buildLocalPasskeyItems(
            [
                {
                    credentialId: 'Y3JlZC1pZA==',
                    origin: 'webauthn.io',
                    identity: 'alice',
                    counter: 0,
                    publicKeySpkiDer: 'cHVi',
                    seedAddress: 'SEEDADDRESS',
                    createdAt: 1,
                },
            ],
            0,
            hashAddress,
        )

        await pushDirty({ state, localItems, deps })

        const [, , , request] = deps.batchUpsertItems.mock.calls[0]
        const plaintext = decryptItemPayload(request.items[0].payload, {
            encryptionKey,
            backupId: 'b',
            key,
        })
        expect(JSON.parse(plaintext).updatedAt).toBe(1_700_000_000)
    })

    it('pushes a settings item from its tracked document, with no local item', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: 'settings/S',
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 3,
                },
            ],
        })
        const state = reconcileSettings(
            createEmptySyncState('b'),
            'settings/S',
            TEST_SETTINGS,
            100,
        )

        const next = await pushDirty({ state, localItems: [], deps })

        const [, , , request] = deps.batchUpsertItems.mock.calls[0]
        const [entry] = request.items
        expect(entry).toMatchObject({
            key: 'settings/S',
            type: BackupItemType.SETTINGS,
            expected_ver: 0,
        })
        expect(
            JSON.parse(
                decryptItemPayload(entry.payload, {
                    encryptionKey,
                    backupId: 'b',
                    key: 'settings/S',
                }),
            ),
        ).toEqual({
            confirmationMode: { value: 'slide', updatedAt: 0 },
            currency: { value: TEST_SETTINGS.currency, updatedAt: 0 },
            language: { value: 'system', updatedAt: 0 },
            launchAccount: { value: TEST_SETTINGS.launchAccount, updatedAt: 0 },
        })
        expect(next.items['settings/S']).toMatchObject({
            isDirty: false,
            knownVer: 1,
        })
    })
})
