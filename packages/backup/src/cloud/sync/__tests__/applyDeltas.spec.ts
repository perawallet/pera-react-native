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
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    createEmptySyncState,
} from '../../models'
import { applyDeltas } from '../applyDeltas'

const encryptionKey = new Uint8Array(32).fill(7)
const baseDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'did:pera:ADDR',
    deviceId: 'dev',
    encryptionKey,
    importAccounts: vi.fn(async () => ({
        imported: 1,
        skippedDuplicate: 0,
        failed: [],
    })),
    readItems: vi.fn(),
    decrypt: vi.fn(),
})

describe('applyDeltas', () => {
    it('imports a new ACTIVE account and records its remote ver/hash + content hash', async () => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue([
            { key: 'accounts/X', ver: 3, hash: 'rh', payload: 'enc' },
        ])
        deps.decrypt.mockReturnValue(
            JSON.stringify({ type: 'watch', address: 'X', customName: 'N' }),
        )

        const next = await applyDeltas({
            state: createEmptySyncState('b'),
            deltas: [
                {
                    seq: 5,
                    key: 'accounts/X',
                    type: BackupItemType.ACCOUNT,
                    ver: 3,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'rh',
                },
            ],
            deps,
        })

        expect(deps.importAccounts).toHaveBeenCalledTimes(1)
        expect(next.items['accounts/X']).toMatchObject({
            knownVer: 3,
            baseVer: 3,
            isDirty: false,
            lastRemoteHash: 'rh',
            localUpdatedAt: null,
        })
        expect(next.lastSyncedSeq).toBe(5)
    })

    it('marks a DELETE delta IGNORED without downloading', async () => {
        const deps = baseDeps()
        const next = await applyDeltas({
            state: createEmptySyncState('b'),
            deltas: [
                {
                    seq: 6,
                    key: 'accounts/Y',
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.DELETE,
                    hash: null,
                },
            ],
            deps,
        })
        expect(deps.readItems).not.toHaveBeenCalled()
        expect(next.items['accounts/Y']).toMatchObject({
            status: BackupItemStatus.IGNORED,
            isDirty: false,
            pendingDelete: false,
        })
    })

    it('LWW: keeps local when local edit is newer than the incoming remote', async () => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue([
            { key: 'accounts/Z', ver: 4, hash: 'rh2', payload: 'enc' },
        ])
        deps.decrypt.mockReturnValue(
            JSON.stringify({ type: 'watch', address: 'Z', updatedAt: 100 }),
        )
        const state = createEmptySyncState('b')
        state.items['accounts/Z'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 3,
            baseVer: 3,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'rh1',
            localContentHash: 'lh',
            localUpdatedAt: 200,
        }
        const next = await applyDeltas({
            state,
            deltas: [
                {
                    seq: 7,
                    key: 'accounts/Z',
                    type: BackupItemType.ACCOUNT,
                    ver: 4,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'rh2',
                },
            ],
            deps,
        })
        expect(deps.importAccounts).not.toHaveBeenCalled()
        expect(next.items['accounts/Z']).toMatchObject({
            isDirty: true,
            knownVer: 4,
            baseVer: 4,
            lastRemoteHash: 'rh2',
        })
    })

    it('LWW: on a timestamp tie, remote wins (imports and clears dirty)', async () => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue([
            { key: 'accounts/Z', ver: 4, hash: 'rh2', payload: 'enc' },
        ])
        // Remote updatedAt equals local localUpdatedAt → tie → remote wins (spec §8).
        deps.decrypt.mockReturnValue(
            JSON.stringify({ type: 'watch', address: 'Z', updatedAt: 200 }),
        )
        const state = createEmptySyncState('b')
        state.items['accounts/Z'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 3,
            baseVer: 3,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'rh1',
            localContentHash: 'lh',
            localUpdatedAt: 200,
        }
        const next = await applyDeltas({
            state,
            deltas: [
                {
                    seq: 7,
                    key: 'accounts/Z',
                    type: BackupItemType.ACCOUNT,
                    ver: 4,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'rh2',
                },
            ],
            deps,
        })
        expect(deps.importAccounts).toHaveBeenCalledTimes(1)
        expect(next.items['accounts/Z']).toMatchObject({
            isDirty: false,
            baseVer: 4,
            localUpdatedAt: null,
        })
    })

    it('synthesizes a standalone hdSeed entry for an orphan seed secret arriving via incremental sync', async () => {
        const deps = baseDeps()
        // An orphan seed secret (its first-derived account was deleted) arrives
        // alongside a sibling HD child, but with NO matching accounts/F item.
        deps.readItems.mockResolvedValue([
            { key: 'secrets/F', ver: 1, hash: 'hF', payload: 'encF' },
            { key: 'accounts/G', ver: 1, hash: 'hG', payload: 'encG' },
        ])
        const plaintextByKey: Record<string, string> = {
            'secrets/F': JSON.stringify({
                type: 'hdSeed',
                seed: 'aa'.repeat(96),
                entropy: 'bb'.repeat(32),
            }),
            'accounts/G': JSON.stringify({
                type: 'hdWallet',
                address: 'G',
                seedFirstDerivedAddress: 'F',
                publicKey: 'cc',
                account: 0,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
                customName: null,
                updatedAt: 1,
            }),
        }
        deps.decrypt.mockImplementation(
            (_payload: string, ctx: { key: string }) => plaintextByKey[ctx.key],
        )

        await applyDeltas({
            state: createEmptySyncState('b'),
            deltas: [
                {
                    seq: 10,
                    key: 'secrets/F',
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'hF',
                },
                {
                    seq: 11,
                    key: 'accounts/G',
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'hG',
                },
            ],
            deps,
        })

        // The orphan hdSeed secret must be surfaced as a standalone hdSeed entry
        // (mirroring full restore) so its sibling HD children find the seed;
        // otherwise the seed is dropped and accounts/G fails "No parent seed".
        expect(deps.importAccounts).toHaveBeenCalledTimes(1)
        expect(deps.importAccounts).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    address: 'F',
                    addressPayload: { type: 'hdSeed', address: 'F' },
                    secretsPayload: expect.objectContaining({ type: 'hdSeed' }),
                }),
            ]),
        )
    })
})
