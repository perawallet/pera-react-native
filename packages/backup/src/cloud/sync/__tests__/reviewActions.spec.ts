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
    createEmptySyncState,
    type SyncItemState,
    type SyncState,
} from '../../models'
import {
    deleteFromBackup,
    importFromBackup,
    keepAccountInBackup,
    markAccountForBackup,
} from '../reviewActions'

const tracked = (overrides: Partial<SyncItemState> = {}): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 2,
    baseVer: 2,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'r',
    localContentHash: null,
    localUpdatedAt: null,
    ...overrides,
})

const baseDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'did:pera:ADDR',
    deviceId: 'dev',
    encryptionKey: new Uint8Array(32).fill(7),
    importAccounts: vi.fn(async () => ({
        imported: 1,
        skippedDuplicate: 0,
        failed: [],
    })),
    readItems: vi.fn(),
    deleteItem: vi.fn(async () => ({ seq: 1 })),
    decrypt: vi.fn(),
})

const withReviewed = (address: string): SyncState => {
    const state = createEmptySyncState('b')
    state.items[`accounts/${address}`] = tracked({ pendingImport: true })
    state.items[`secrets/${address}`] = tracked({ pendingImport: true })
    return state
}

describe('markAccountForBackup', () => {
    it('forgets the tombstone so reconcile re-tracks the address at version 0', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked({
            status: BackupItemStatus.IGNORED,
        })
        state.items['secrets/A'] = tracked({
            status: BackupItemStatus.IGNORED,
        })
        state.items['accounts/B'] = tracked()

        const next = markAccountForBackup(state, 'A')
        expect(next.items['accounts/A']).toBeUndefined()
        expect(next.items['secrets/A']).toBeUndefined()
        expect(next.items['accounts/B']).toBeDefined()
    })
})

describe('importFromBackup', () => {
    it('reads the address + secrets keys, imports them and clears the review flag', async () => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue([
            { key: 'accounts/X', ver: 4, hash: 'rh', payload: 'enc' },
            { key: 'secrets/X', ver: 4, hash: 'sh', payload: 'enc' },
        ])
        deps.decrypt.mockImplementation((_payload, ctx) =>
            ctx.key.startsWith('accounts/')
                ? JSON.stringify({ type: 'algo25', address: 'X' })
                : JSON.stringify({
                      type: 'algo25',
                      mnemonic: 'word '.repeat(25).trim(),
                  }),
        )

        const { state, summary } = await importFromBackup({
            state: withReviewed('X'),
            address: 'X',
            deps,
        })

        expect(deps.readItems).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev',
            ['accounts/X', 'secrets/X'],
        )
        expect(summary.imported).toBe(1)
        expect(state.items['accounts/X']).toMatchObject({
            pendingImport: false,
            knownVer: 4,
            baseVer: 4,
            lastRemoteHash: 'rh',
        })
    })

    it('also reads the parent seed secret for an HD child', async () => {
        const deps = baseDeps()
        const state = withReviewed('CHILD')
        state.items['secrets/SEED'] = tracked()

        deps.readItems
            .mockResolvedValueOnce([
                { key: 'accounts/CHILD', ver: 4, hash: 'rh', payload: 'enc' },
            ])
            .mockResolvedValueOnce([
                { key: 'secrets/SEED', ver: 2, hash: 'sh', payload: 'enc' },
            ])
        deps.decrypt.mockImplementation((_payload, ctx) =>
            ctx.key === 'accounts/CHILD'
                ? JSON.stringify({
                      type: 'hdWallet',
                      address: 'CHILD',
                      account: 0,
                      change: 0,
                      keyIndex: 1,
                      derivationType: 9,
                      publicKey: 'cc',
                      seedFirstDerivedAddress: 'SEED',
                  })
                : JSON.stringify({ type: 'hdSeed', seed: 'aa', entropy: 'bb' }),
        )

        await importFromBackup({ state, address: 'CHILD', deps })

        expect(deps.readItems).toHaveBeenNthCalledWith(
            2,
            'mainnet',
            'did:pera:ADDR',
            'dev',
            ['secrets/SEED'],
        )
        // Two entries: the child, plus the standalone hdSeed the joiner
        // synthesizes so the parent seed is persisted before the child derives.
        const [pulled] = deps.importAccounts.mock.calls[0]
        expect(
            pulled.map((a: { address: string }) => a.address).sort(),
        ).toEqual(['CHILD', 'SEED'])
    })

    it('fails without a read when the backup no longer holds the address', async () => {
        const deps = baseDeps()
        const { summary } = await importFromBackup({
            state: createEmptySyncState('b'),
            address: 'X',
            deps,
        })

        expect(deps.readItems).not.toHaveBeenCalled()
        expect(summary.failed).toHaveLength(1)
    })
})

const backupHolding = (
    addresses: string[],
    secretAddresses: string[],
): SyncState => {
    const state = createEmptySyncState('b')
    for (const address of addresses)
        state.items[`accounts/${address}`] = tracked()
    for (const address of secretAddresses)
        state.items[`secrets/${address}`] = tracked()
    return state
}

/** Decrypts `accounts/A` as an HD child of `seedOf[A]`, or as algo25 when absent. */
const hdAwareDecrypt = (seedOf: Record<string, string>) =>
    vi.fn((_payload: string, ctx: { key: string }) => {
        const address = ctx.key.slice(ctx.key.indexOf('/') + 1)
        if (!ctx.key.startsWith('accounts/')) {
            return JSON.stringify({ type: 'hdSeed', seed: 'aa', entropy: 'bb' })
        }
        const seed = seedOf[address]
        return seed === undefined
            ? JSON.stringify({ type: 'algo25', address })
            : JSON.stringify({
                  type: 'hdWallet',
                  address,
                  seedFirstDerivedAddress: seed,
                  publicKey: 'pk',
                  account: 0,
                  change: 0,
                  keyIndex: 0,
                  derivationType: 0,
              })
    })

const readsFor = (keys: string[]) =>
    vi.fn(async (_n: unknown, _b: unknown, _d: unknown, requested: string[]) =>
        requested
            .filter(key => keys.includes(key))
            .map(key => ({ key, ver: 4, hash: 'rh', payload: 'enc' })),
    )

describe('deleteFromBackup', () => {
    it('deletes both keys and leaves a tombstone behind', async () => {
        const deps = {
            ...baseDeps(),
            readItems: readsFor(['accounts/X']),
            decrypt: hdAwareDecrypt({}),
        }
        const next = await deleteFromBackup({
            state: withReviewed('X'),
            address: 'X',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(2)
        expect(next.items['accounts/X']).toMatchObject({
            status: BackupItemStatus.IGNORED,
            pendingImport: false,
        })
        expect(next.items['secrets/X']).toMatchObject({
            status: BackupItemStatus.IGNORED,
        })
    })

    it('queues a retry instead of throwing when the request fails', async () => {
        const deps = {
            ...baseDeps(),
            readItems: readsFor(['accounts/X']),
            decrypt: hdAwareDecrypt({}),
            deleteItem: vi.fn(async () => {
                throw new Error('offline')
            }),
        }

        const next = await deleteFromBackup({
            state: withReviewed('X'),
            address: 'X',
            deps,
        })

        expect(next.items['accounts/X'].pendingDelete).toBe(true)
        expect(next.items['accounts/X'].status).toBe(BackupItemStatus.ACTIVE)
    })

    it('keeps the shared seed when a sibling still derives from it', async () => {
        const state = backupHolding(['FIRST', 'CHILD'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor(['accounts/FIRST', 'accounts/CHILD']),
            decrypt: hdAwareDecrypt({ FIRST: 'FIRST', CHILD: 'FIRST' }),
        }

        const next = await deleteFromBackup({ state, address: 'FIRST', deps })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev',
            'accounts/FIRST',
        )
        expect(next.items['secrets/FIRST'].status).toBe(BackupItemStatus.ACTIVE)
    })

    it('deletes the seed once no account derives from it any more', async () => {
        const state = backupHolding(['FIRST'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor(['accounts/FIRST']),
            decrypt: hdAwareDecrypt({ FIRST: 'FIRST' }),
        }

        const next = await deleteFromBackup({ state, address: 'FIRST', deps })

        expect(deps.deleteItem).toHaveBeenCalledTimes(2)
        expect(next.items['accounts/FIRST'].status).toBe(
            BackupItemStatus.IGNORED,
        )
        expect(next.items['secrets/FIRST'].status).toBe(
            BackupItemStatus.IGNORED,
        )
    })

    it('sweeps the seed when the last account of it is a non-first child', async () => {
        const state = backupHolding(['CHILD'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor(['accounts/CHILD']),
            decrypt: hdAwareDecrypt({ CHILD: 'FIRST' }),
        }

        const next = await deleteFromBackup({ state, address: 'CHILD', deps })

        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev',
            'secrets/FIRST',
        )
        expect(next.items['secrets/FIRST'].status).toBe(
            BackupItemStatus.IGNORED,
        )
    })

    it('keeps the seed when a sibling cannot be read', async () => {
        const state = backupHolding(['FIRST', 'CHILD'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor(['accounts/FIRST']),
            decrypt: hdAwareDecrypt({ FIRST: 'FIRST' }),
        }

        const next = await deleteFromBackup({ state, address: 'FIRST', deps })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(next.items['secrets/FIRST'].status).toBe(BackupItemStatus.ACTIVE)
    })

    it('deletes the address alone when the read fails outright', async () => {
        const state = backupHolding(['X'], ['X'])
        const deps = {
            ...baseDeps(),
            readItems: vi.fn(async () => {
                throw new Error('offline')
            }),
        }

        const next = await deleteFromBackup({ state, address: 'X', deps })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(next.items['secrets/X'].status).toBe(BackupItemStatus.ACTIVE)
    })
})

describe('keepAccountInBackup', () => {
    it('marks the live keys for review so the copy survives on the server', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/X'] = tracked({ isDirty: true })
        state.items['secrets/X'] = tracked()

        const next = keepAccountInBackup(state, 'X')

        expect(next.items['accounts/X']).toMatchObject({
            pendingImport: true,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
        })
        expect(next.items['secrets/X'].pendingImport).toBe(true)
    })

    it('leaves a tombstoned key alone', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/X'] = tracked({
            status: BackupItemStatus.IGNORED,
        })

        const next = keepAccountInBackup(state, 'X')

        expect(next.items['accounts/X'].pendingImport).toBeUndefined()
    })
})
