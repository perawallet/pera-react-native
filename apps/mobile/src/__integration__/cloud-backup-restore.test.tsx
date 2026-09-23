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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'
import { File } from 'expo-file-system'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    BackupAccountType,
    buildBackupCredentialsFile,
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
    initializeBackupSyncManager,
} from '@perawallet/wallet-core-backup'
import {
    accountItemKey,
    buildRestoreHandlers,
    buildSyncHandlers,
    contactItemKey,
    createItemKeyHasher,
    secretsItemKey,
    type ItemKeyHasher,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'

import { CloudBackupScreen } from '@modules/cloud-backup/screens/CloudBackupScreen'
import { CloudBackupRestorePassphraseScreen } from '@modules/cloud-backup/screens/CloudBackupRestorePassphraseScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'
// The stack's own registration, not the bare screen: the terminal exit lives
// there, and a hand-rolled wrapper here would let it rot unnoticed.
import { CloudBackupRestoreEncryptionKeyRoute } from '@modules/cloud-backup/routes'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    SLOW_TEST_TIMEOUT_MS,
    renderQueryHook,
    seedHDWalletAccounts,
} from './__fixtures__/cloudBackup'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'

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

const typeBackupWords = (words: string[]) => {
    words.forEach((word, index) => {
        fireEvent.change(
            screen.getByTestId(`cloud_backup_restore_word_input_${index}`),
            { target: { value: word } },
        )
    })
}

const runRestoreFlow = async () => {
    fireEvent.click(screen.getByTestId('cloud_backup_restore_option'))
    fireEvent.click(
        await screen.findByTestId('cloud_backup_restore_sheet_manual'),
    )

    await waitFor(() => screen.getByTestId('cloud_backup_restore_word_input_0'))
    typeBackupWords(BACKUP_MNEMONIC)
    fireEvent.click(
        screen.getByTestId('cloud_backup_restore_passphrase_continue'),
    )

    const keyInput = await screen.findByTestId('cloud_backup_restore_key_input')
    fireEvent.change(keyInput, { target: { value: BACKUP_SALT } })
    fireEvent.click(screen.getByTestId('cloud_backup_restore_key_button'))
}

/** Matches the toast title, not just its presence: the partial-success toast
 *  lands on the overview too. */
const expectRestoreLandedOnOverview = async () => {
    expect(
        await screen.findByTestId('cloud_backup_overview_screen'),
    ).toBeTruthy()
    await waitFor(() => {
        const titles = vi
            .mocked(Notifier.showNotification)
            .mock.calls.map(call => call[0].title)
        expect(titles).toContain('cloud_backup.restore.success')
    })
}

/** The pair a pushed Algo25 account leaves behind. */
const algo25BackupItems = (hashAddress: ItemKeyHasher) => [
    {
        key: accountItemKey(hashAddress(ALGO25_TEST_ADDRESS)),
        plaintext: JSON.stringify({
            type: BackupAccountType.algo25,
            address: ALGO25_TEST_ADDRESS,
            customName: 'Restored',
        }),
    },
    {
        key: secretsItemKey(hashAddress(ALGO25_TEST_ADDRESS)),
        plaintext: JSON.stringify({
            type: BackupAccountType.algo25,
            mnemonic: ALGO25_TEST_MNEMONIC,
            address: ALGO25_TEST_ADDRESS,
        }),
    },
]

describe('Flow: Cloud backup → Restore', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useCloudBackupRestoreDraftStore.getState().resetState()
        // Restore reads the device id for the active network; without it the
        // hook bails to onError('UNKNOWN') before pulling anything.
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(File.pickFileAsync).mockReset()
    })

    it(
        'Given a valid backup passphrase and encryption key, when the user restores, then the encrypted Algo25 account is decrypted and imported into the wallet',
        async () => {
            const { backupId, encryptionKey, itemKey } = await deriveBackupKeys(
                {
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                },
            )

            server.use(
                ...buildRestoreHandlers({
                    backupId,
                    encryptionKey,
                    items: algo25BackupItems(createItemKeyHasher(itemKey)),
                }),
            )

            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(
                () => {
                    expect(
                        useAccountsStore
                            .getState()
                            .accounts.some(
                                a => a.address === ALGO25_TEST_ADDRESS,
                            ),
                    ).toBe(true)
                },
                { timeout: 10_000 },
            )

            // `isConfigured` flips only after import + name update complete.
            await waitFor(() => {
                expect(useCloudBackupStore.getState().isConfigured()).toBe(true)
            })

            const restored = useAccountsStore
                .getState()
                .accounts.find(a => a.address === ALGO25_TEST_ADDRESS)
            expect(restored?.type).toBe(AccountTypes.algo25)
            expect(restored?.name).toBe('Restored')

            // The restore has to hand the sync engine the versions the server
            // holds. Tracking an item at 0 offers it as new, the server refuses
            // the write, and no delta ever follows to correct it.
            const syncState = useBackupSyncStateStore.getState().syncState
            expect(syncState).not.toBeNull()
            const tracked = Object.values(syncState?.items ?? {})
            expect(tracked.length).toBeGreaterThan(0)
            expect(tracked.every(item => item.knownVer > 0)).toBe(true)

            await expectRestoreLandedOnOverview()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an HD backup (hdWallet items + an hdSeed secret), when the user restores, then the seed is reconstructed and all HD accounts are imported',
        async () => {
            const { backupId, encryptionKey, authSecretKey, itemKey } =
                await deriveBackupKeys({
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                })
            const hashAddress = createItemKeyHasher(itemKey)

            // Restore out of what a real push wrote: a hand-written fixture
            // would keep passing against a payload shape nothing produces.
            const { first, second } = await seedHDWalletAccounts()
            await persistBackupKeys({
                encryptionKey,
                authSecretKey,
                itemKey,
                mnemonic: BACKUP_MNEMONIC,
            })
            useCloudBackupStore.getState().setConfigured({
                backupId,
                salt: BACKUP_SALT,
                deviceId: 'test-device-id',
            })

            const { handlers, getItem } = buildSyncHandlers({ backupId })
            server.use(...handlers)

            const importHook = renderQueryHook(() => useCloudBackupImport())
            const hdHook = renderQueryHook(() => useResolveHdSeedForBackup())
            const contactImportHook = renderQueryHook(() =>
                useCloudBackupContactImport(),
            )
            const mnemonicHook = renderQueryHook(() =>
                useResolveMnemonicForBackup(),
            )
            await initializeBackupSyncManager({
                importAccounts: importHook.current.importAccounts,
                importContacts: contactImportHook.current.importContacts,
                resolveMnemonic: mnemonicHook.current,
                resolveHd: hdHook.current,
                listPasskeys: async () => [],
                importPasskeys: async () => ({
                    imported: 0,
                    skipped: [],
                    failed: [],
                }),
                subscribePasskeyChanges: () => () => {},
            }).syncNow()

            expect(
                getItem(accountItemKey(hashAddress(first.address))),
            ).toBeDefined()
            expect(
                getItem(secretsItemKey(hashAddress(first.address))),
            ).toBeDefined()

            // Wipe the device; the fake backend keeps what was pushed.
            resetTestKeystore()
            useAccountsStore.getState().setAccounts([])
            useCloudBackupStore.getState().resetState()
            useBackupSyncStateStore.getState().resetState()
            await deleteBackupKeys().catch(() => undefined)

            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(
                () => {
                    const addresses = useAccountsStore
                        .getState()
                        .accounts.map(a => a.address)
                    expect(addresses).toContain(first.address)
                    expect(addresses).toContain(second.address)
                },
                { timeout: 10_000 },
            )

            await waitFor(() => {
                expect(useCloudBackupStore.getState().isConfigured()).toBe(true)
            })

            const accounts = useAccountsStore.getState().accounts
            const restoredFirst = accounts.find(
                a => a.address === first.address,
            )
            const restoredSecond = accounts.find(
                a => a.address === second.address,
            )
            expect(restoredFirst?.type).toBe(AccountTypes.hdWallet)
            expect(restoredSecond?.type).toBe(AccountTypes.hdWallet)
            expect(restoredFirst?.name).toBe('HD First')
            expect(restoredSecond?.name).toBe('HD Second')

            expect(useBackupSyncStateStore.getState().syncState).not.toBeNull()
            await expectRestoreLandedOnOverview()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // The restore is the only path that can deliver them: it seeds
    // `lastSyncedSeq` from the manifest, so no later delta mentions an item
    // that was already in the backup when this device joined.
    it(
        'Given a backup holding contacts, when the user restores, then the contacts are on the device',
        async () => {
            const { backupId, encryptionKey, itemKey } = await deriveBackupKeys(
                {
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                },
            )
            const hashAddress = createItemKeyHasher(itemKey)
            const contactKey = contactItemKey(hashAddress('CONTACT_A'))

            server.use(
                ...buildRestoreHandlers({
                    backupId,
                    encryptionKey,
                    items: [
                        ...algo25BackupItems(hashAddress),
                        {
                            key: contactKey,
                            plaintext: JSON.stringify({
                                address: 'CONTACT_A',
                                name: 'Alice',
                                updatedAt: 1,
                            }),
                        },
                    ],
                }),
            )

            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(
                () => {
                    expect(useContactsStore.getState().contacts).toEqual([
                        { address: 'CONTACT_A', name: 'Alice' },
                    ])
                },
                { timeout: 10_000 },
            )

            // Tracked at the server's version, so the first sync after the
            // restore does not offer it back as new.
            await waitFor(() => {
                const item =
                    useBackupSyncStateStore.getState().syncState?.items[
                        contactKey
                    ]
                expect(item?.knownVer).toBeGreaterThan(0)
            })
            await expectRestoreLandedOnOverview()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an encryption key file saved on the device, when the user imports it and types the passphrase, then the key screen shows the imported key and the backup restores from it',
        async () => {
            const { backupId, encryptionKey, itemKey } = await deriveBackupKeys(
                {
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                },
            )
            server.use(
                ...buildRestoreHandlers({
                    backupId,
                    encryptionKey,
                    items: algo25BackupItems(createItemKeyHasher(itemKey)),
                }),
            )
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
                canceled: false,
                result: {
                    size: buildBackupCredentialsFile(BACKUP_SALT).length,
                    text: async () => buildBackupCredentialsFile(BACKUP_SALT),
                },
            } as never)

            renderCloudBackupFlow()
            fireEvent.click(screen.getByTestId('cloud_backup_restore_option'))
            fireEvent.click(
                await screen.findByTestId('cloud_backup_restore_sheet_device'),
            )

            await waitFor(() =>
                screen.getByTestId('cloud_backup_restore_word_input_0'),
            )
            typeBackupWords(BACKUP_MNEMONIC)
            fireEvent.click(
                screen.getByTestId('cloud_backup_restore_passphrase_continue'),
            )

            const keyInput = await screen.findByTestId(
                'cloud_backup_restore_key_input',
            )
            expect((keyInput as HTMLInputElement).value).toBe(BACKUP_SALT)
            fireEvent.click(
                screen.getByTestId('cloud_backup_restore_key_button'),
            )

            await waitFor(
                () => {
                    expect(
                        useAccountsStore
                            .getState()
                            .accounts.some(
                                a => a.address === ALGO25_TEST_ADDRESS,
                            ),
                    ).toBe(true)
                },
                { timeout: 10_000 },
            )
            await expectRestoreLandedOnOverview()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
