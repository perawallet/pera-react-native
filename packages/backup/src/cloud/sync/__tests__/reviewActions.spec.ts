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
import { passkeyItemKey } from '../../models/itemKeys'
import { describe, expect, it, vi } from 'vitest'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemStatus,
    BackupItemType,
    accountItemKey,
    contactItemKey,
    createEmptySyncState,
    secretsItemKey,
    type BackupItemKey,
    type SyncItemState,
    type SyncState,
} from '../../models'
import {
    deleteContactFromBackup,
    deleteFromBackup,
    deletePasskeyFromBackup,
    importContactFromBackup,
    importFromBackup,
    importPasskeyFromBackup,
    keepAccountInBackup,
    keepContactInBackup,
    keepPasskeyInBackup,
    markAccountForBackup,
    markContactForBackup,
    markPasskeyForBackup,
} from '../reviewActions'
import type { PulledAccount } from '../types'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const accountKey = (address: string): BackupItemKey =>
    accountItemKey(hashAddress(address))
const secretsKey = (address: string): BackupItemKey =>
    secretsItemKey(hashAddress(address))
const contactKey = (address: string): BackupItemKey =>
    contactItemKey(hashAddress(address))

const tracked = (
    address: string,
    overrides: Partial<SyncItemState> = {},
): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 2,
    baseVer: 2,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'r',
    localContentHash: null,
    localUpdatedAt: null,
    address,
    ...overrides,
})

const baseDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'did:pera:ADDR',
    deviceId: 'dev',
    encryptionKey: new Uint8Array(32).fill(7),
    hashAddress,
    importAccounts: vi.fn(async (_accounts: PulledAccount[]) => ({
        imported: 1,
        skippedDuplicate: 0,
        failed: [],
    })),
    importContacts: vi.fn(async () => ({ imported: 1, failed: [] })),
    importPasskeys: vi.fn(async () => ({
        imported: 1,
        skipped: [],
        failed: [],
    })),
    readItems: vi.fn(),
    deleteItem: vi.fn(async () => ({ seq: 1 })),
    decrypt: vi.fn(),
})

/** Every fixture declares its plaintext per key: the test has to say which
 *  record each opaque key holds. */
const servingPlaintext = (byKey: Record<BackupItemKey, unknown>) =>
    vi.fn((_payload: string, ctx: { key: BackupItemKey }) =>
        JSON.stringify(byKey[ctx.key] ?? {}),
    )

const readsFor = (keys: BackupItemKey[]) =>
    vi.fn(
        async (
            _n: unknown,
            _b: unknown,
            _d: unknown,
            requested: BackupItemKey[],
        ) =>
            requested
                .filter(key => keys.includes(key))
                .map(key => ({ key, ver: 4, hash: 'rh', payload: 'enc' })),
    )

const withReviewed = (address: string): SyncState => {
    const state = createEmptySyncState('b')
    state.items[accountKey(address)] = tracked(address, {
        pendingImport: true,
    })
    state.items[secretsKey(address)] = tracked(address, {
        pendingImport: true,
    })
    return state
}

const algo25Address = (address: string) => ({ type: 'algo25', address })
const algo25Secrets = (address: string) => ({
    type: 'algo25',
    mnemonic: 'word '.repeat(25).trim(),
    address,
})
const hdWalletAddress = (address: string, seedFirstDerivedAddress: string) => ({
    type: 'hdWallet',
    address,
    seedFirstDerivedAddress,
    publicKey: 'pk',
    account: 0,
    change: 0,
    keyIndex: 0,
    derivationType: 0,
})
const hdSeedSecrets = (address: string) => ({
    type: 'hdSeed',
    seed: 'aa',
    entropy: 'bb',
    address,
})

describe('markAccountForBackup', () => {
    it('forgets the tombstone so reconcile re-tracks the address at version 0', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            status: BackupItemStatus.IGNORED,
        })
        state.items[secretsKey('A')] = tracked('A', {
            status: BackupItemStatus.IGNORED,
        })
        state.items[accountKey('B')] = tracked('B')

        const next = markAccountForBackup(state, 'A')
        expect(next.items[accountKey('A')]).toBeUndefined()
        expect(next.items[secretsKey('A')]).toBeUndefined()
        expect(next.items[accountKey('B')]).toBeDefined()
    })

    it('leaves an item the device has never decrypted alone', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', { address: null })

        expect(
            markAccountForBackup(state, 'A').items[accountKey('A')],
        ).toBeDefined()
    })
})

describe('importFromBackup', () => {
    it('reads the address + secrets keys, imports them and clears the review flag', async () => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue([
            { key: accountKey('X'), ver: 4, hash: 'rh', payload: 'enc' },
            { key: secretsKey('X'), ver: 4, hash: 'sh', payload: 'enc' },
        ])
        deps.decrypt.mockImplementation(
            servingPlaintext({
                [accountKey('X')]: algo25Address('X'),
                [secretsKey('X')]: algo25Secrets('X'),
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
            [accountKey('X'), secretsKey('X')],
        )
        // `secretsPayload` would be null had the payload failed to parse, which
        // `collect` swallows.
        const [pulled] = deps.importAccounts.mock.calls[0]
        expect(pulled).toEqual([
            {
                address: 'X',
                addressPayload: expect.objectContaining({ address: 'X' }),
                secretsPayload: expect.objectContaining({ type: 'algo25' }),
            },
        ])
        expect(summary.imported).toBe(1)
        expect(state.items[accountKey('X')]).toMatchObject({
            pendingImport: false,
            knownVer: 4,
            baseVer: 4,
            lastRemoteHash: 'rh',
        })
    })

    it('also reads the parent seed secret for an HD child', async () => {
        const deps = baseDeps()
        const state = withReviewed('CHILD')
        state.items[secretsKey('SEED')] = tracked('SEED')

        deps.readItems
            .mockResolvedValueOnce([
                {
                    key: accountKey('CHILD'),
                    ver: 4,
                    hash: 'rh',
                    payload: 'enc',
                },
            ])
            .mockResolvedValueOnce([
                { key: secretsKey('SEED'), ver: 2, hash: 'sh', payload: 'enc' },
            ])
        deps.decrypt.mockImplementation(
            servingPlaintext({
                [accountKey('CHILD')]: hdWalletAddress('CHILD', 'SEED'),
                [secretsKey('SEED')]: hdSeedSecrets('SEED'),
            }),
        )

        await importFromBackup({ state, address: 'CHILD', deps })

        expect(deps.readItems).toHaveBeenNthCalledWith(
            2,
            'mainnet',
            'did:pera:ADDR',
            'dev',
            [secretsKey('SEED')],
        )
        // Two entries: the child, plus the standalone hdSeed the joiner
        // synthesizes so the parent seed is persisted before the child derives.
        // The seed entry only exists if the secrets payload parsed.
        const [pulled] = deps.importAccounts.mock.calls[0]
        expect(pulled.map(account => account.address).sort()).toEqual([
            'CHILD',
            'SEED',
        ])
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
        state.items[accountKey(address)] = tracked(address)
    for (const address of secretAddresses)
        state.items[secretsKey(address)] = tracked(address)
    return state
}

/** Serves `accounts/<hash(A)>` as an HD child of `seedOf[A]`, or as algo25 when
 *  absent. */
const hdAwareDecrypt = (seedOf: Record<string, string>) =>
    servingPlaintext(
        Object.fromEntries(
            Object.entries(seedOf).map(([address, seed]) => [
                accountKey(address),
                hdWalletAddress(address, seed),
            ]),
        ),
    )

describe('deleteFromBackup', () => {
    it('deletes both keys and leaves a tombstone behind', async () => {
        const deps = {
            ...baseDeps(),
            readItems: readsFor([accountKey('X')]),
            decrypt: servingPlaintext({
                [accountKey('X')]: algo25Address('X'),
            }),
        }
        const { state: next } = await deleteFromBackup({
            state: withReviewed('X'),
            address: 'X',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(2)
        expect(next.items[accountKey('X')]).toMatchObject({
            status: BackupItemStatus.IGNORED,
            pendingImport: false,
        })
        expect(next.items[secretsKey('X')]).toMatchObject({
            status: BackupItemStatus.IGNORED,
        })
    })

    it('queues a retry instead of throwing when the request fails', async () => {
        const deps = {
            ...baseDeps(),
            readItems: readsFor([accountKey('X')]),
            decrypt: servingPlaintext({
                [accountKey('X')]: algo25Address('X'),
            }),
            deleteItem: vi.fn(async () => {
                throw new Error('offline')
            }),
        }

        const { state: next } = await deleteFromBackup({
            state: withReviewed('X'),
            address: 'X',
            deps,
        })

        expect(next.items[accountKey('X')].pendingDelete).toBe(true)
        expect(next.items[accountKey('X')].status).toBe(BackupItemStatus.ACTIVE)
    })

    it('keeps the shared seed when a sibling still derives from it', async () => {
        const state = backupHolding(['FIRST', 'CHILD'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor([accountKey('FIRST'), accountKey('CHILD')]),
            decrypt: hdAwareDecrypt({ FIRST: 'FIRST', CHILD: 'FIRST' }),
        }

        const { state: next } = await deleteFromBackup({
            state,
            address: 'FIRST',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev',
            accountKey('FIRST'),
        )
        expect(next.items[secretsKey('FIRST')].status).toBe(
            BackupItemStatus.ACTIVE,
        )
    })

    it('deletes the seed once no account derives from it any more', async () => {
        const state = backupHolding(['FIRST'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor([accountKey('FIRST')]),
            decrypt: hdAwareDecrypt({ FIRST: 'FIRST' }),
        }

        const { state: next } = await deleteFromBackup({
            state,
            address: 'FIRST',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(2)
        expect(next.items[accountKey('FIRST')].status).toBe(
            BackupItemStatus.IGNORED,
        )
        expect(next.items[secretsKey('FIRST')].status).toBe(
            BackupItemStatus.IGNORED,
        )
    })

    it('sweeps the seed when the last account of it is a non-first child', async () => {
        const state = backupHolding(['CHILD'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor([accountKey('CHILD')]),
            decrypt: hdAwareDecrypt({ CHILD: 'FIRST' }),
        }

        const { state: next } = await deleteFromBackup({
            state,
            address: 'CHILD',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev',
            secretsKey('FIRST'),
        )
        expect(next.items[secretsKey('FIRST')].status).toBe(
            BackupItemStatus.IGNORED,
        )
    })

    it('keeps the seed when a sibling cannot be read', async () => {
        const state = backupHolding(['FIRST', 'CHILD'], ['FIRST'])
        const deps = {
            ...baseDeps(),
            readItems: readsFor([accountKey('FIRST')]),
            decrypt: hdAwareDecrypt({ FIRST: 'FIRST' }),
        }

        const { state: next } = await deleteFromBackup({
            state,
            address: 'FIRST',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(next.items[secretsKey('FIRST')].status).toBe(
            BackupItemStatus.ACTIVE,
        )
    })

    it('deletes the address alone when the read fails outright', async () => {
        const state = backupHolding(['X'], ['X'])
        const deps = {
            ...baseDeps(),
            readItems: vi.fn(async () => {
                throw new Error('offline')
            }),
        }

        const { state: next } = await deleteFromBackup({
            state,
            address: 'X',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(next.items[secretsKey('X')].status).toBe(BackupItemStatus.ACTIVE)
    })
})

describe('keepAccountInBackup', () => {
    it('marks the live keys for review so the copy survives on the server', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('X')] = tracked('X', { isDirty: true })
        state.items[secretsKey('X')] = tracked('X')

        const next = keepAccountInBackup(state, 'X')

        expect(next.items[accountKey('X')]).toMatchObject({
            pendingImport: true,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
        })
        expect(next.items[secretsKey('X')].pendingImport).toBe(true)
    })

    it('leaves a tombstoned key alone', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('X')] = tracked('X', {
            status: BackupItemStatus.IGNORED,
        })

        const next = keepAccountInBackup(state, 'X')

        expect(next.items[accountKey('X')].pendingImport).toBeUndefined()
    })
})

describe('contact review actions', () => {
    const contact = (overrides: Partial<SyncItemState> = {}): SyncState => {
        const state = createEmptySyncState('b')
        state.items[contactKey('A')] = tracked('A', {
            type: BackupItemType.CONTACT,
            ...overrides,
        })
        return state
    }

    const servingContact = (payload: Record<string, unknown> | null) => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue(
            payload === null
                ? []
                : [
                      {
                          key: contactKey('A'),
                          ver: 4,
                          hash: 'rh',
                          payload: 'enc',
                      },
                  ],
        )
        deps.decrypt.mockReturnValue(JSON.stringify(payload ?? {}))
        return deps
    }

    it('markContactForBackup forgets the tracked item so it re-uploads as new', () => {
        const next = markContactForBackup(contact({ knownVer: 3 }), 'A')

        expect(next.items[contactKey('A')]).toBeUndefined()
    })

    it('keepContactInBackup holds it for review with its name', () => {
        const next = keepContactInBackup(
            contact({ isDirty: true }),
            'A',
            'Alice',
        )

        expect(next.items[contactKey('A')]).toMatchObject({
            pendingImport: true,
            isDirty: false,
            pendingDelete: false,
            label: 'Alice',
        })
    })

    it('keepContactInBackup leaves a contact the backup never held alone', () => {
        const state = contact({ status: BackupItemStatus.IGNORED })

        expect(keepContactInBackup(state, 'A', 'Alice')).toBe(state)
    })

    it('importContactFromBackup re-reads the item and imports it', async () => {
        const deps = servingContact({ address: 'A', name: 'Alice' })

        const { state: next, summary } = await importContactFromBackup({
            state: contact({ pendingImport: true }),
            address: 'A',
            deps,
        })

        expect(deps.importContacts).toHaveBeenCalledWith([
            { address: 'A', name: 'Alice' },
        ])
        expect(summary.imported).toBe(1)
        expect(next.items[contactKey('A')]).toMatchObject({
            pendingImport: false,
            label: 'Alice',
            knownVer: 4,
        })
    })

    it('importContactFromBackup reports a contact the backup no longer holds', async () => {
        const deps = servingContact(null)

        const { summary } = await importContactFromBackup({
            state: contact({ status: BackupItemStatus.IGNORED }),
            address: 'A',
            deps,
        })

        expect(deps.readItems).not.toHaveBeenCalled()
        expect(summary.imported).toBe(0)
        expect(summary.failed).toHaveLength(1)
    })

    it('deleteContactFromBackup deletes the one key and tombstones it', async () => {
        const deps = baseDeps()

        const { state: next } = await deleteContactFromBackup({
            state: contact(),
            address: 'A',
            deps,
        })

        expect(deps.deleteItem).toHaveBeenCalledTimes(1)
        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev',
            contactKey('A'),
        )
        expect(next.items[contactKey('A')]).toMatchObject({
            status: BackupItemStatus.IGNORED,
            pendingDelete: false,
        })
    })

    it('deleteContactFromBackup makes no request for a contact already gone', async () => {
        const deps = baseDeps()

        await deleteContactFromBackup({
            state: contact({ status: BackupItemStatus.IGNORED }),
            address: 'A',
            deps,
        })

        expect(deps.deleteItem).not.toHaveBeenCalled()
    })
})

const PASSKEY_ONE_KEY = passkeyItemKey(hashAddress('one'))

describe('passkey review actions', () => {
    const passkey = (overrides: Partial<SyncItemState> = {}): SyncState => {
        const state = createEmptySyncState('b')
        state.items[PASSKEY_ONE_KEY] = tracked('one', {
            type: BackupItemType.PASSKEY,
            ...overrides,
        })
        return state
    }

    const servingPasskey = (payload: Record<string, unknown> | null) => {
        const deps = baseDeps()
        deps.readItems.mockResolvedValue(
            payload === null
                ? []
                : [
                      {
                          key: PASSKEY_ONE_KEY,
                          ver: 4,
                          hash: 'rh',
                          payload: 'enc',
                      },
                  ],
        )
        deps.decrypt.mockReturnValue(JSON.stringify(payload ?? {}))
        return deps
    }

    it('markPasskeyForBackup drops the tombstone so the item re-uploads at version 0', () => {
        const next = markPasskeyForBackup(
            passkey({ status: BackupItemStatus.IGNORED }),
            'one',
        )

        expect(next.items[PASSKEY_ONE_KEY]).toBeUndefined()
    })

    it('keepPasskeyInBackup holds the item for review with its label', () => {
        const next = keepPasskeyInBackup(passkey(), 'one', 'Alice')

        expect(next.items[PASSKEY_ONE_KEY]).toMatchObject({
            pendingImport: true,
            label: 'Alice',
        })
    })

    it('keepPasskeyInBackup leaves a state the backup does not hold alone', () => {
        const state = passkey({ status: BackupItemStatus.IGNORED })

        expect(keepPasskeyInBackup(state, 'one', 'Alice')).toBe(state)
    })

    it('deletePasskeyFromBackup tombstones the key it deleted', async () => {
        const deps = baseDeps()

        const result = await deletePasskeyFromBackup({
            state: passkey(),
            credentialId: 'one',
            deps,
        })

        expect(result.keys).toEqual([PASSKEY_ONE_KEY])
        expect(result.state.items[PASSKEY_ONE_KEY].status).toBe(
            BackupItemStatus.IGNORED,
        )
    })

    it('deletePasskeyFromBackup makes no request for a credential already gone', async () => {
        const deps = baseDeps()

        await deletePasskeyFromBackup({
            state: passkey({ status: BackupItemStatus.IGNORED }),
            credentialId: 'one',
            deps,
        })

        expect(deps.deleteItem).not.toHaveBeenCalled()
    })

    it('importPasskeyFromBackup reports a credential the backup does not hold', async () => {
        const deps = servingPasskey(null)

        const { summary } = await importPasskeyFromBackup({
            state: passkey({ status: BackupItemStatus.IGNORED }),
            credentialId: 'one',
            deps,
        })

        expect(deps.readItems).not.toHaveBeenCalled()
        expect(summary.imported).toBe(0)
        expect(summary.failed[0].credentialId).toBe('one')
    })

    it('importPasskeyFromBackup re-reads the item and imports it', async () => {
        const deps = servingPasskey({
            credentialId: 'one',
            origin: 'https://example.com',
            identity: 'user@example.com',
            counter: 0,
            publicKeySpkiDer: 'pk',
            seedAddress: 'SEED',
            displayName: 'Alice',
            createdAt: 5,
            updatedAt: 5,
        })

        const { state: next, summary } = await importPasskeyFromBackup({
            state: passkey({ pendingImport: true }),
            credentialId: 'one',
            deps,
        })

        expect(deps.importPasskeys).toHaveBeenCalledWith([
            expect.objectContaining({ credentialId: 'one' }),
        ])
        expect(summary.imported).toBe(1)
        expect(next.items[PASSKEY_ONE_KEY]).toMatchObject({
            pendingImport: false,
            label: 'Alice',
            knownVer: 4,
        })
    })

    it('importPasskeyFromBackup falls back to the origin when no display name was cached', async () => {
        const deps = servingPasskey({
            credentialId: 'one',
            origin: 'https://example.com',
            identity: 'user@example.com',
            counter: 0,
            publicKeySpkiDer: 'pk',
            seedAddress: 'SEED',
            createdAt: 5,
            updatedAt: 5,
        })

        const { state: next } = await importPasskeyFromBackup({
            state: passkey({ pendingImport: true }),
            credentialId: 'one',
            deps,
        })

        expect(next.items[PASSKEY_ONE_KEY]).toMatchObject({
            label: 'https://example.com',
        })
    })
})
