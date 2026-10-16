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

// The backup is read and written by app versions on both sides of the account
// and contact records: the released app writes per-address `accounts/` and
// `contacts/` items and ignores records, and a later app may write records
// this one cannot read.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    BackupAccountType,
    BackupItemStatus,
    type BackupItemKind,
    BackupItemType,
    createEmptySyncState,
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupStore,
    useBackupSyncStateStore,
    useCloudBackupRestoreDraftStore,
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
    type ItemKeyHasher,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useDeviceStore } from '@perawallet/wallet-core-device'

import { CloudBackupScreen } from '@modules/cloud-backup/screens/CloudBackupScreen'
import {
    CloudBackupRestorePassphraseScreen,
    CloudBackupRestoreEncryptionKeyRoute,
} from '@modules/cloud-backup/routes'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'
import { CloudBackupAccountsReviewScreen } from '@modules/cloud-backup/screens/CloudBackupAccountsReviewScreen'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    renderQueryHook,
    seedHDWalletAccounts,
} from './__fixtures__/cloudBackup'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

// The released app's wire kinds, which the Algorand backup adapter owns.
const ALGO25 = 'algo25'
const HD_WALLET = 'hdWallet'
const ALGORAND_PEIKERT = 9

type Keys = Awaited<ReturnType<typeof deriveBackupKeys>>

const renderCloudBackupFlow = () =>
    renderWithNavigation(CloudBackupScreen, 'CloudBackupHome', {
        additionalScreens: [
            {
                name: 'CloudBackupRestorePassphrase',
                component: CloudBackupRestorePassphraseScreen,
            },
            {
                name: 'CloudBackupRestoreEncryptionKey',
                component: CloudBackupRestoreEncryptionKeyRoute,
            },
            {
                name: 'CloudBackupOverview',
                component: CloudBackupOverviewScreen,
            },
        ],
    })

const runRestoreFlow = async () => {
    fireEvent.click(screen.getByTestId('cloud_backup_restore_option'))
    fireEvent.click(
        await screen.findByTestId('cloud_backup_restore_sheet_manual'),
    )
    await waitFor(() => screen.getByTestId('cloud_backup_restore_word_input_0'))
    BACKUP_MNEMONIC.forEach((word, index) => {
        fireEvent.change(
            screen.getByTestId(`cloud_backup_restore_word_input_${index}`),
            { target: { value: word } },
        )
    })
    fireEvent.click(
        screen.getByTestId('cloud_backup_restore_passphrase_continue'),
    )
    const keyInput = await screen.findByTestId('cloud_backup_restore_key_input')
    fireEvent.change(keyInput, { target: { value: BACKUP_SALT } })
    fireEvent.click(screen.getByTestId('cloud_backup_restore_key_button'))
}

const toastTitles = () =>
    vi.mocked(Notifier.showNotification).mock.calls.map(call => call[0].title)

const encrypt = (
    { backupId, encryptionKey }: Keys,
    key: string,
    payload: unknown,
) => ({
    key,
    payload: encryptItemPayload(JSON.stringify(payload), {
        encryptionKey,
        backupId,
        key,
    }),
})

/** What the released app wrote for the Algo25 test account. */
const legacyAlgo25 = (
    keys: Keys,
    hashAddress: ItemKeyHasher,
    name = 'Legacy name',
) => [
    encrypt(keys, accountItemKey(hashAddress(ALGO25_TEST_ADDRESS)), {
        type: ALGO25,
        address: ALGO25_TEST_ADDRESS,
        customName: name,
        updatedAt: 1,
    }),
    encrypt(keys, secretsItemKey(hashAddress(ALGO25_TEST_ADDRESS)), {
        type: ALGO25,
        mnemonic: ALGO25_TEST_MNEMONIC,
        address: ALGO25_TEST_ADDRESS,
    }),
]

const algo25Record = (formatVersion: number, name: string) => ({
    formatVersion,
    customName: name,
    updatedAt: 2,
    chains: [{ chain: 'algorand', type: ALGO25, address: ALGO25_TEST_ADDRESS }],
})

/** Starts this device's sync engine over the backup the restore just joined
 *  (or one set up directly), as the app shell would. */
const startSync = () => {
    const importHook = renderQueryHook(() =>
        useCloudBackupImport(useSelectedScope(LEGACY_CHAIN_ID)),
    )
    const contactImportHook = renderQueryHook(() =>
        useCloudBackupContactImport(),
    )
    const mnemonicHook = renderQueryHook(() =>
        useResolveMnemonicForBackup(LEGACY_CHAIN_ID),
    )
    const hdHook = renderQueryHook(() =>
        useResolveHdSeedForBackup(LEGACY_CHAIN_ID),
    )
    return initializeBackupSyncManager({
        chainId: LEGACY_CHAIN_ID,
        sources: createBackupSyncStoreSources(LEGACY_CHAIN_ID),
        importAccounts: importHook.current.importAccounts,
        importContacts: contactImportHook.current.importContacts,
        resolveMnemonic: mnemonicHook.current,
        resolveHd: hdHook.current,
        isLocked: () => false,
        listPasskeys: async () => [],
        importPasskeys: async () => ({ imported: 0, skipped: [], failed: [] }),
        subscribePasskeyChanges: () => () => {},
    })
}

const configureBackup = async (keys: Keys) => {
    await persistBackupKeys({
        encryptionKey: keys.encryptionKey,
        authSecretKey: keys.authSecretKey,
        itemKey: keys.itemKey,
        mnemonic: BACKUP_MNEMONIC,
    })
    useCloudBackupStore.getState().setConfigured({
        backupId: keys.backupId,
        salt: BACKUP_SALT,
        deviceId: 'test-device-id',
    })
}

const accountWith = (address: string) =>
    useAccountsStore
        .getState()
        .accounts.find(
            a => chainAccountOf(a, LEGACY_CHAIN_ID)?.address === address,
        )

describe('Flow: Cloud backup across format versions', () => {
    let keys: Keys
    let hashAddress: ItemKeyHasher

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useCloudBackupRestoreDraftStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().mode, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.mocked(Notifier.showNotification).mockClear()
        keys = await deriveBackupKeys({
            mnemonic: BACKUP_MNEMONIC,
            salt: BACKUP_SALT,
        })
        hashAddress = createItemKeyHasher(keys.itemKey)
    })

    it('Given a backup only the released app wrote, when it is restored and synced, then every account comes back and is written as a record while the legacy items stay as they were', async () => {
        // The released app's HD items, built from a real seed so the restore
        // re-derives the same addresses.
        const { first, second } = await seedHDWalletAccounts()
        const hdHook = renderQueryHook(() =>
            useResolveHdSeedForBackup(LEGACY_CHAIN_ID),
        )
        const resolved = await hdHook.current(
            first as Parameters<typeof hdHook.current>[0],
        )
        expect(resolved).not.toBeNull()
        const legacyHd = (account: WalletAccount, name: string) => {
            const { custody } = account
            if (custody.kind !== 'local' || custody.seed !== 'bip39')
                throw new Error('fixture is not an HD account')
            return encrypt(
                keys,
                accountItemKey(hashAddress(addressOf(account))),
                {
                    type: HD_WALLET,
                    address: addressOf(account),
                    seedFirstDerivedAddress: resolved!.seedFirstDerivedAddress,
                    publicKey: '00',
                    account: custody.hd.account,
                    change: 0,
                    keyIndex: custody.hd.keyIndex,
                    derivationType: ALGORAND_PEIKERT,
                    customName: name,
                    updatedAt: 1,
                },
            )
        }
        const { handlers, getItem } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [
                ...legacyAlgo25(keys, hashAddress),
                legacyHd(first, 'HD First'),
                legacyHd(second, 'HD Second'),
                encrypt(
                    keys,
                    secretsItemKey(
                        hashAddress(resolved!.seedFirstDerivedAddress),
                    ),
                    {
                        type: BackupAccountType.hdSeed,
                        seed: resolved!.seedHex,
                        entropy: resolved!.entropyHex,
                        address: resolved!.seedFirstDerivedAddress,
                    },
                ),
            ],
        })
        server.use(...handlers)
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])

        renderCloudBackupFlow()
        await runRestoreFlow()
        await waitFor(
            () => {
                expect(accountWith(ALGO25_TEST_ADDRESS)).toBeDefined()
                expect(accountWith(addressOf(first))).toBeDefined()
                expect(accountWith(addressOf(second))).toBeDefined()
            },
            { timeout: 10_000 },
        )
        await waitFor(() =>
            expect(useCloudBackupStore.getState().isConfigured()).toBe(true),
        )

        await startSync().syncNow()

        const seed = resolved!.seedFirstDerivedAddress
        for (const identity of [
            ALGO25_TEST_ADDRESS,
            `${seed}/0/0`,
            `${seed}/0/1`,
        ]) {
            expect(
                getItem(accountRecordItemKey(hashAddress(identity))),
            ).toBeDefined()
        }
        for (const address of [
            ALGO25_TEST_ADDRESS,
            addressOf(first),
            addressOf(second),
        ]) {
            expect(getItem(accountItemKey(hashAddress(address)))?.ver).toBe(1)
        }
    })

    it('Given a backup holding both a record and a legacy item for one account, when it is restored, then one account comes back as the record describes it', async () => {
        const { handlers } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [
                ...legacyAlgo25(keys, hashAddress, 'Legacy name'),
                encrypt(
                    keys,
                    accountRecordItemKey(hashAddress(ALGO25_TEST_ADDRESS)),
                    algo25Record(2, 'Record name'),
                ),
            ],
        })
        server.use(...handlers)

        renderCloudBackupFlow()
        await runRestoreFlow()

        await waitFor(
            () => expect(accountWith(ALGO25_TEST_ADDRESS)).toBeDefined(),
            { timeout: 10_000 },
        )
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(accountWith(ALGO25_TEST_ADDRESS)?.name).toBe('Record name')
    })

    it('Given a backup holding a record only a newer app can read, when it is restored and synced, then the user is told to update and the record is never written over', async () => {
        const recordKey = accountRecordItemKey(hashAddress(ALGO25_TEST_ADDRESS))
        const newer = encrypt(keys, recordKey, {
            ...algo25Record(3, 'Future name'),
            futureField: true,
        })
        const { handlers, getItem } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [...legacyAlgo25(keys, hashAddress), newer],
        })
        server.use(...handlers)

        renderCloudBackupFlow()
        await runRestoreFlow()

        await waitFor(
            () =>
                expect(toastTitles()).toContain(
                    'cloud_backup.restore.update_to_restore',
                ),
            { timeout: 10_000 },
        )
        expect(accountWith(ALGO25_TEST_ADDRESS)).toBeDefined()
        expect(
            await screen.findByTestId('cloud_backup_overview_update_required'),
        ).toBeTruthy()

        await startSync().syncNow()

        expect(getItem(recordKey)).toMatchObject({
            ver: 1,
            payload: newer.payload,
        })
    })

    it('Given the released app deletes an HD seed that a record here still derives from, when this device syncs, then it uploads the seed again', async () => {
        const { first } = await seedHDWalletAccounts()
        await configureBackup(keys)
        const { handlers, getItem, pushFromOtherDevice } = buildSyncHandlers({
            backupId: keys.backupId,
        })
        server.use(...handlers)
        const manager = startSync()
        await manager.syncNow()
        const seedKey = secretsItemKey(hashAddress(addressOf(first)))
        const pushedVersion = getItem(seedKey)?.ver
        expect(pushedVersion).toBe(1)

        // The released app counts only `accounts/` items as the seed's users,
        // so deleting account #0 there takes the seed with it. A remote write
        // moves the manifest off its known hash so the delete is fetched.
        const contactKey = contactItemKey(hashAddress('CONTACT_A'))
        pushFromOtherDevice(
            contactKey,
            encrypt(keys, contactKey, {
                address: 'CONTACT_A',
                name: 'Alice',
                updatedAt: 1,
            }).payload,
        )
        server.use(
            http.get(
                '*/delta',
                () =>
                    HttpResponse.json({
                        entries: [
                            {
                                seq: 10_000,
                                key: seedKey,
                                type: BackupItemType.ACCOUNT,
                                ver: 2,
                                status: BackupItemStatus.IGNORED,
                                op: 'DELETE',
                                hash: null,
                            },
                        ],
                    }),
                { once: true },
            ),
        )
        await manager.syncNow()
        expect(
            useBackupSyncStateStore.getState().syncState?.items[seedKey]
                ?.status,
        ).toBe(BackupItemStatus.IGNORED)

        await manager.syncNow()

        expect(getItem(seedKey)?.ver).toBeGreaterThan(pushedVersion!)
        expect(
            useBackupSyncStateStore.getState().syncState?.items[seedKey]
                ?.status,
        ).toBe(BackupItemStatus.ACTIVE)
    })

    it('Given a held record only a newer app can read, when the review screen shows it, then it asks for an update instead of offering Add', async () => {
        await configureBackup(keys)
        server.use(...buildSyncHandlers({ backupId: keys.backupId }).handlers)
        startSync()
        const address =
            'ZZZ7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'
        useBackupSyncStateStore.getState().setSyncState({
            ...createEmptySyncState(keys.backupId),
            items: {
                [accountRecordItemKey(hashAddress(address))]: {
                    type: BackupItemType.ACCOUNT,
                    knownVer: 1,
                    baseVer: 1,
                    isDirty: false,
                    status: BackupItemStatus.ACTIVE,
                    lastRemoteHash: null,
                    pendingImport: true,
                    address,
                    addresses: [address],
                    accountType: ALGO25 as BackupItemKind,
                    record: {
                        formatVersion: 3,
                        chains: [{ chain: 'algorand', type: ALGO25, address }],
                    },
                },
            },
        })

        renderWithNavigation(
            CloudBackupAccountsReviewScreen,
            'CloudBackupAccountsReview',
        )

        expect(
            await screen.findByTestId('add_from_backup_needs_update'),
        ).toBeTruthy()
        expect(screen.queryByTestId('add_from_backup_button')).toBeNull()
    })
})

describe('Flow: Cloud backup of contacts across format versions', () => {
    let keys: Keys
    let hashAddress: ItemKeyHasher

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useCloudBackupRestoreDraftStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().mode, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        keys = await deriveBackupKeys({
            mnemonic: BACKUP_MNEMONIC,
            salt: BACKUP_SALT,
        })
        hashAddress = createItemKeyHasher(keys.itemKey)
    })

    const legacyContact = (address: string, name: string) =>
        encrypt(keys, contactItemKey(hashAddress(address)), {
            address,
            name,
            updatedAt: 1,
        })

    const recordKey = (id: string) => contactRecordItemKey(hashAddress(id))

    const contactRecord = (record: { id: string } & Record<string, unknown>) =>
        encrypt(keys, recordKey(record.id), record)

    // The id every device derives for a contact saved before contacts had ids.
    const MIGRATED_ID = 'algorand:CONTACT_A'

    const record = (
        id: string,
        name: string,
        addresses: { family: string; address: string }[],
        formatVersion = 1,
    ) => ({ formatVersion, id, name, updatedAt: 2, addresses })

    const recordPlaintext = (key: string, payload: string) =>
        JSON.parse(
            decryptItemPayload(payload, {
                encryptionKey: keys.encryptionKey,
                backupId: keys.backupId,
                key,
            }),
        )

    const restoreContacts = async () => {
        renderCloudBackupFlow()
        await runRestoreFlow()
        await waitFor(
            () =>
                expect(useCloudBackupStore.getState().isConfigured()).toBe(
                    true,
                ),
            { timeout: 10_000 },
        )
    }

    it('Given a backup only the released app wrote, when it is restored and synced, then every contact comes back, is written as a record, and its legacy item stays as it was', async () => {
        const { handlers, getItem } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [
                legacyContact('CONTACT_A', 'Alice'),
                legacyContact('CONTACT_B', 'Bob'),
            ],
        })
        server.use(...handlers)

        await restoreContacts()
        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'algorand:CONTACT_A',
                addresses: { algorand: 'CONTACT_A' },
                name: 'Alice',
            },
            {
                id: 'algorand:CONTACT_B',
                addresses: { algorand: 'CONTACT_B' },
                name: 'Bob',
            },
        ])

        await startSync().syncNow()

        for (const address of ['CONTACT_A', 'CONTACT_B']) {
            expect(getItem(recordKey(`algorand:${address}`))).toBeDefined()
            expect(getItem(contactItemKey(hashAddress(address)))?.ver).toBe(1)
        }
    })

    it('Given a backup holding both a record and a legacy item for one contact, when it is restored, then one contact comes back as the record describes it', async () => {
        const { handlers } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [
                legacyContact('CONTACT_A', 'Legacy name'),
                contactRecord(
                    record(MIGRATED_ID, 'Record name', [
                        { family: 'algorand', address: 'CONTACT_A' },
                        { family: 'evm', address: '0xA11CE' },
                    ]),
                ),
            ],
        })
        server.use(...handlers)

        await restoreContacts()

        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: MIGRATED_ID,
                addresses: { algorand: 'CONTACT_A', evm: '0xA11CE' },
                name: 'Record name',
            },
        ])
    })

    it('Given a backup holding a record from a newer format, when it is restored and synced, then the contact is not imported and the record is never written over', async () => {
        const key = recordKey(MIGRATED_ID)
        const newer = contactRecord(
            record(
                MIGRATED_ID,
                'Future name',
                [{ family: 'algorand', address: 'CONTACT_A' }],
                2,
            ),
        )
        const { handlers, getItem } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [newer],
        })
        server.use(...handlers)

        await restoreContacts()
        expect(useContactsStore.getState().contacts).toEqual([])

        // The same contact, migrated here, must not push over it.
        useContactsStore.getState().addContact({
            id: MIGRATED_ID,
            addresses: { algorand: 'CONTACT_A' },
            name: 'Local name',
        })
        await startSync().syncNow()

        expect(getItem(key)).toMatchObject({ ver: 1, payload: newer.payload })
    })

    it('Given a record holding a family this app does not know, when the contact is renamed here and synced, then the family is still in the record', async () => {
        const key = recordKey(MIGRATED_ID)
        const { handlers, getItem } = buildSyncHandlers({
            backupId: keys.backupId,
            initial: [
                contactRecord({
                    ...record(MIGRATED_ID, 'Alice', [
                        { family: 'algorand', address: 'CONTACT_A' },
                        { family: 'solana', address: 'SOL_A' },
                    ]),
                    futureField: 'kept',
                }),
            ],
        })
        server.use(...handlers)

        await restoreContacts()
        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: MIGRATED_ID,
                addresses: { algorand: 'CONTACT_A' },
                name: 'Alice',
            },
        ])
        const manager = startSync()
        await manager.syncNow()

        useContactsStore.getState().editContact(MIGRATED_ID, {
            addresses: { algorand: 'CONTACT_A' },
            name: 'Alicia',
        })
        await manager.syncNow()

        const written = recordPlaintext(key, getItem(key)!.payload)
        expect(written).toMatchObject({
            name: 'Alicia',
            futureField: 'kept',
            addresses: [
                { family: 'algorand', address: 'CONTACT_A' },
                { family: 'solana', address: 'SOL_A' },
            ],
        })
    })

    it('Given contacts holding Algorand and Ethereum addresses and an Ethereum-only contact, when they are backed up and restored on a fresh device, then every address and name comes back', async () => {
        useContactsStore.getState().addContact({
            addresses: { algorand: 'CONTACT_A', evm: '0xA11CE' },
            name: 'Alice',
        })
        useContactsStore
            .getState()
            .addContact({ addresses: { evm: '0xB0B' }, name: 'Bob' })
        await configureBackup(keys)
        const { handlers } = buildSyncHandlers({ backupId: keys.backupId })
        server.use(...handlers)
        await startSync().syncNow()
        const ids = useContactsStore.getState().contacts.map(c => c.id)

        // A fresh device: nothing local, no backup configured.
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        await deleteBackupKeys().catch(() => undefined)

        await restoreContacts()

        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: ids[0],
                addresses: { algorand: 'CONTACT_A', evm: '0xA11CE' },
                name: 'Alice',
            },
            { id: ids[1], addresses: { evm: '0xB0B' }, name: 'Bob' },
        ])
    })
})
