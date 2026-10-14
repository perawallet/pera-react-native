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
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    BackupAccountType,
    deriveBackupContactReview,
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupStore,
    useBackupSyncStateStore,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
    createBackupSyncStoreSources,
    initializeBackupSyncManager,
} from '@perawallet/wallet-core-backup'
import {
    accountItemKey,
    accountRecordItemKey,
    buildSyncHandlers,
    contactItemKey,
    contactRecordItemKey,
    createItemKeyHasher,
    decryptItemPayload,
    encryptItemPayload,
    secretsItemKey,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useDeviceStore } from '@perawallet/wallet-core-device'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    renderQueryHook,
    seedAlgo25Account,
    seedHDWalletAccounts,
} from './__fixtures__/cloudBackup'
import { ALGO25_TEST_MNEMONIC } from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

type SetupOptions = {
    /** Device id the backup is registered under; the manager signs with this
     *  one, not whatever the device store currently holds. */
    deviceId?: string
    /** Off by default, so a wallet with no HD accounts proves it never needs
     *  the resolver. */
    withHdResolver?: boolean
}

const setupSyncedBackup = async ({
    deviceId = 'test-device-id',
    withHdResolver = false,
}: SetupOptions = {}) => {
    const { backupId, encryptionKey, authSecretKey, itemKey } =
        await deriveBackupKeys({
            mnemonic: BACKUP_MNEMONIC,
            salt: BACKUP_SALT,
        })
    const hashAddress = createItemKeyHasher(itemKey)
    await persistBackupKeys({
        encryptionKey,
        authSecretKey,
        itemKey,
        mnemonic: BACKUP_MNEMONIC,
    })
    useCloudBackupStore.getState().setConfigured({
        backupId,
        salt: BACKUP_SALT,
        deviceId,
    })

    const { handlers, getItem, seenDeviceIds, pushFromOtherDevice } =
        buildSyncHandlers({ backupId })
    server.use(...handlers)

    const importHook = renderQueryHook(() =>
        useCloudBackupImport(useSelectedScope(LEGACY_CHAIN_ID)),
    )
    const contactImportHook = renderQueryHook(() =>
        useCloudBackupContactImport(),
    )
    const mnemonicHook = renderQueryHook(() =>
        useResolveMnemonicForBackup(LEGACY_CHAIN_ID),
    )
    const hdHook = withHdResolver
        ? renderQueryHook(() => useResolveHdSeedForBackup(LEGACY_CHAIN_ID))
        : null

    const manager = initializeBackupSyncManager({
        chainId: LEGACY_CHAIN_ID,
        sources: createBackupSyncStoreSources(LEGACY_CHAIN_ID),
        importAccounts: importHook.current.importAccounts,
        importContacts: contactImportHook.current.importContacts,
        resolveMnemonic: mnemonicHook.current,
        resolveHd: hdHook ? hdHook.current : async () => null,
        isLocked: () => false,
        listPasskeys: async () => [],
        importPasskeys: async () => ({ imported: 0, skipped: [], failed: [] }),
        subscribePasskeyChanges: () => () => {},
    })

    return {
        manager,
        getItem,
        seenDeviceIds,
        pushFromOtherDevice,
        backupId,
        encryptionKey,
        accountKey: (address: string) => accountItemKey(hashAddress(address)),
        // What this client writes: one record per account, keyed by its
        // identity (`seedFirst/account/keyIndex` for HD, else its address).
        // test-handlers doesn't re-export the record key builder.
        recordKey: (identity: string) =>
            accountRecordItemKey(hashAddress(identity)),
        secretsKey: (address: string) => secretsItemKey(hashAddress(address)),
        // What this client writes for a contact: one record, keyed by the
        // hash of its first address.
        contactKey: (address: string) =>
            contactRecordItemKey(hashAddress(address)),
        legacyContactKey: (address: string) =>
            contactItemKey(hashAddress(address)),
    }
}

describe('Flow: Cloud backup → Sync (push round-trip)', () => {
    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()
    })

    it('pushes a local Algo25 account: address + decryptable secret land on the backend, sync state recorded', async () => {
        const account = await seedAlgo25Account()

        const {
            manager,
            getItem,
            backupId,
            encryptionKey,
            recordKey,
            secretsKey,
        } = await setupSyncedBackup()
        await manager.syncNow()

        const addressKey = recordKey(addressOf(account))
        const secretKey = secretsKey(addressOf(account))
        expect(getItem(addressKey)).toBeDefined()

        const secretItem = getItem(secretKey)
        expect(secretItem).toBeDefined()
        const plaintext = decryptItemPayload(secretItem!.payload, {
            encryptionKey,
            backupId,
            key: secretKey,
        })
        expect(JSON.parse(plaintext)).toMatchObject({
            type: 'algo25',
            mnemonic: ALGO25_TEST_MNEMONIC,
        })

        const syncState = useBackupSyncStateStore.getState().syncState
        expect(syncState?.lastSyncResult).toBe('SUCCESS')
        expect(syncState?.items[addressKey]).toMatchObject({
            isDirty: false,
        })
    })

    it('signs with the device id the backup was registered under, not the current one in the device store', async () => {
        await seedAlgo25Account()

        const { manager, seenDeviceIds } = await setupSyncedBackup({
            deviceId: 'registered-device',
        })
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'current-device')
        await manager.syncNow()

        expect(
            useBackupSyncStateStore.getState().syncState?.lastSyncResult,
        ).toBe('SUCCESS')
        expect(seenDeviceIds().length).toBeGreaterThan(0)
        expect(new Set(seenDeviceIds())).toEqual(new Set(['registered-device']))
    })

    it('pushes HD accounts: one record per account + a single hdSeed secret', async () => {
        const { first, second } = await seedHDWalletAccounts()

        const {
            manager,
            getItem,
            backupId,
            encryptionKey,
            recordKey,
            secretsKey,
        } = await setupSyncedBackup({ withHdResolver: true })
        await manager.syncNow()

        const firstKey = recordKey(`${addressOf(first)}/0/0`)
        expect(getItem(firstKey)).toBeDefined()
        expect(getItem(recordKey(`${addressOf(first)}/0/1`))).toBeDefined()
        expect(getItem(secretsKey(addressOf(second)))).toBeUndefined()

        const seedItem = getItem(secretsKey(addressOf(first)))
        expect(seedItem).toBeDefined()
        const plaintext = decryptItemPayload(seedItem!.payload, {
            encryptionKey,
            backupId,
            key: secretsKey(addressOf(first)),
        })
        expect(JSON.parse(plaintext)).toMatchObject({
            type: BackupAccountType.hdSeed,
        })

        const recordItem = getItem(firstKey)!
        const recordPlain = decryptItemPayload(recordItem.payload, {
            encryptionKey,
            backupId,
            key: firstKey,
        })
        expect(JSON.parse(recordPlain)).toMatchObject({
            formatVersion: 2,
            chains: [
                {
                    chain: 'algorand',
                    type: 'hdWallet',
                    address: addressOf(first),
                    seedFirstDerivedAddress: addressOf(first),
                    account: 0,
                    keyIndex: 0,
                },
            ],
        })
    })

    it('deletes the account from the server when the user chooses Delete', async () => {
        const account = await seedAlgo25Account()
        const { manager, getItem, recordKey, secretsKey } =
            await setupSyncedBackup()

        await manager.syncNow()
        expect(getItem(recordKey(addressOf(account)))).toBeDefined()

        expect(await manager.deleteAccountFromBackup(addressOf(account))).toBe(
            'settled',
        )
        useAccountsStore.getState().setAccounts([])
        await manager.syncNow()

        expect(getItem(recordKey(addressOf(account)))).toBeUndefined()
        expect(getItem(secretsKey(addressOf(account)))).toBeUndefined()
    })

    it('leaves the server copy alone when the user chooses Keep it', async () => {
        const account = await seedAlgo25Account()
        const { manager, getItem, recordKey, secretsKey } =
            await setupSyncedBackup()

        await manager.syncNow()
        expect(await manager.keepAccountInBackup(addressOf(account))).toBe(true)
        useAccountsStore.getState().setAccounts([])
        await manager.syncNow()

        expect(getItem(recordKey(addressOf(account)))).toBeDefined()
        expect(getItem(secretsKey(addressOf(account)))).toBeDefined()
    })
    it('keeps the server copy when an account leaves the device without a choice', async () => {
        const account = await seedAlgo25Account()
        const { manager, getItem, recordKey, secretsKey } =
            await setupSyncedBackup()

        await manager.syncNow()
        expect(getItem(recordKey(addressOf(account)))).toBeDefined()

        // No review action and no removal flow: the shape of a device wipe.
        useAccountsStore.getState().setAccounts([])
        await manager.syncNow()

        expect(getItem(recordKey(addressOf(account)))).toBeDefined()
        expect(getItem(secretsKey(addressOf(account)))).toBeDefined()
    })
    it('keeps the shared HD seed until its last account leaves the backup', async () => {
        const { first, second } = await seedHDWalletAccounts()
        const { manager, getItem, recordKey, secretsKey } =
            await setupSyncedBackup({
                withHdResolver: true,
            })
        await manager.syncNow()

        // The seed rides under the FIRST derived address, so deleting that
        // account must not take the key material its sibling still needs.
        expect(await manager.deleteAccountFromBackup(addressOf(first))).toBe(
            'settled',
        )

        expect(getItem(recordKey(`${addressOf(first)}/0/0`))).toBeUndefined()
        expect(getItem(recordKey(`${addressOf(first)}/0/1`))).toBeDefined()
        expect(getItem(secretsKey(addressOf(first)))).toBeDefined()

        expect(await manager.deleteAccountFromBackup(addressOf(second))).toBe(
            'settled',
        )

        expect(getItem(recordKey(`${addressOf(first)}/0/1`))).toBeUndefined()
        expect(getItem(secretsKey(addressOf(first)))).toBeUndefined()
    })
})

describe('Flow: Cloud backup → Sync (contacts)', () => {
    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()
    })

    const seedContact = (address: string, name: string) =>
        useContactsStore
            .getState()
            .addContact({ addresses: { algorand: address }, name })

    it('pushes a local contact: address + name land on the backend encrypted', async () => {
        seedContact('CONTACT_A', 'Alice')

        const { manager, getItem, backupId, encryptionKey, contactKey } =
            await setupSyncedBackup()
        await manager.syncNow()

        const key = contactKey('CONTACT_A')
        const item = getItem(key)
        expect(item).toBeDefined()
        expect(
            JSON.parse(
                decryptItemPayload(item!.payload, {
                    encryptionKey,
                    backupId,
                    key,
                }),
            ),
        ).toMatchObject({
            name: 'Alice',
            addresses: [{ family: 'algorand', address: 'CONTACT_A' }],
        })
    })

    it('holds a contact the user chose to keep, with its name, for review', async () => {
        seedContact('CONTACT_A', 'Alice')
        const { manager } = await setupSyncedBackup()
        await manager.syncNow()

        expect(await manager.keepContactInBackup('CONTACT_A', 'Alice')).toBe(
            true,
        )
        useContactsStore.getState().resetState()
        await manager.syncNow()

        const review = deriveBackupContactReview(
            useBackupSyncStateStore.getState().syncState,
            [],
        )
        expect(review.availableFromBackup).toEqual([
            { address: 'CONTACT_A', name: 'Alice' },
        ])
        expect(useContactsStore.getState().contacts).toEqual([])
    })

    it('adds a held contact back from the backup on request', async () => {
        seedContact('CONTACT_A', 'Alice')
        const { manager } = await setupSyncedBackup()
        await manager.syncNow()
        await manager.keepContactInBackup('CONTACT_A', 'Alice')
        useContactsStore.getState().resetState()

        const summary = await manager.addContactFromBackup('CONTACT_A')

        expect(summary).toMatchObject({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { algorand: 'CONTACT_A' }, name: 'Alice' },
        ])
    })

    it('deletes the contact from the server when the user chooses Delete', async () => {
        seedContact('CONTACT_A', 'Alice')
        const { manager, getItem, contactKey } = await setupSyncedBackup()
        await manager.syncNow()
        expect(getItem(contactKey('CONTACT_A'))).toBeDefined()

        expect(await manager.deleteContactFromBackup('CONTACT_A')).toBe(
            'settled',
        )
        useContactsStore.getState().resetState()
        await manager.syncNow()

        expect(getItem(contactKey('CONTACT_A'))).toBeUndefined()
    })

    it('keeps the server copy when a contact leaves the device without a choice', async () => {
        seedContact('CONTACT_A', 'Alice')
        const { manager, getItem, contactKey } = await setupSyncedBackup()
        await manager.syncNow()

        // No review action and no removal flow: the shape of a device wipe.
        useContactsStore.getState().resetState()
        await manager.syncNow()

        expect(getItem(contactKey('CONTACT_A'))).toBeDefined()
    })

    it('pulls a contact an older app backed up as a legacy item', async () => {
        const {
            manager,
            pushFromOtherDevice,
            backupId,
            encryptionKey,
            legacyContactKey,
        } = await setupSyncedBackup()
        await manager.syncNow()

        const key = legacyContactKey('CONTACT_B')
        pushFromOtherDevice(
            key,
            encryptItemPayload(
                JSON.stringify({ address: 'CONTACT_B', name: 'Bob' }),
                { encryptionKey, backupId, key },
            ),
        )
        await manager.syncNow()

        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { algorand: 'CONTACT_B' }, name: 'Bob' },
        ])
    })

    it('pulls a contact record another device backed up, with every family', async () => {
        const {
            manager,
            pushFromOtherDevice,
            backupId,
            encryptionKey,
            contactKey,
        } = await setupSyncedBackup()
        await manager.syncNow()

        const key = contactKey('CONTACT_B')
        pushFromOtherDevice(
            key,
            encryptItemPayload(
                JSON.stringify({
                    formatVersion: 1,
                    name: 'Bob',
                    updatedAt: 1,
                    addresses: [
                        { family: 'algorand', address: 'CONTACT_B' },
                        { family: 'evm', address: '0xB0B' },
                    ],
                }),
                { encryptionKey, backupId, key },
            ),
        )
        await manager.syncNow()

        expect(useContactsStore.getState().contacts).toEqual([
            {
                addresses: { algorand: 'CONTACT_B', evm: '0xB0B' },
                name: 'Bob',
            },
        ])
    })

    it('backs up a contact holding only an EVM address, and adds it back after Keep', async () => {
        useContactsStore
            .getState()
            .addContact({ addresses: { evm: '0xB0B' }, name: 'Bob' })
        const { manager, getItem, contactKey } = await setupSyncedBackup()
        await manager.syncNow()
        expect(getItem(contactKey('0xB0B'))).toBeDefined()

        await manager.keepContactInBackup('0xB0B', 'Bob')
        useContactsStore.getState().resetState()
        const summary = await manager.addContactFromBackup('0xB0B')

        expect(summary).toMatchObject({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { evm: '0xB0B' }, name: 'Bob' },
        ])
    })
})
