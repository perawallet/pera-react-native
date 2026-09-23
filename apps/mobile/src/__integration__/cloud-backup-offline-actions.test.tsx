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
import { onlineManager } from '@tanstack/react-query'
import { Notifier } from 'react-native-notifier'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    initializeBackupSyncManager,
    useBackupSyncStateStore,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupStore,
    useResolveMnemonicForBackup,
} from '@perawallet/wallet-core-backup'
import {
    accountItemKey,
    buildSyncHandlers,
    createItemKeyHasher,
    type ItemKeyHasher,
} from '@perawallet/wallet-core-backup/test-handlers'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useNetworkStatusStore } from '@modules/network'
import { CloudBackupAccountsScreen } from '@modules/cloud-backup/screens/CloudBackupAccountsScreen'
import { CloudBackupAccountsReviewScreen } from '@modules/cloud-backup/screens/CloudBackupAccountsReviewScreen'
import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    SLOW_TEST_TIMEOUT_MS,
    renderQueryHook,
    seedAlgo25Account,
} from './__fixtures__/cloudBackup'

const NETWORK = useNetworkStore.getState().network

const REMOTE_ONLY_ADDRESS =
    'ZZZ7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'

const toastTitles = () =>
    vi.mocked(Notifier.showNotification).mock.calls.map(call => call[0].title)

const setConnected = (isConnected: boolean) => {
    onlineManager.setOnline(isConnected)
    useNetworkStatusStore.getState().setHasInternet(isConnected)
}

const setupBackup = async () => {
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
        deviceId: 'test-device-id',
    })

    const { handlers, getItem, seenDeviceIds } = buildSyncHandlers({ backupId })
    server.use(...handlers)

    const importHook = renderQueryHook(() => useCloudBackupImport())
    const contactImportHook = renderQueryHook(() =>
        useCloudBackupContactImport(),
    )
    const mnemonicHook = renderQueryHook(() => useResolveMnemonicForBackup())

    initializeBackupSyncManager({
        importAccounts: importHook.current.importAccounts,
        importContacts: contactImportHook.current.importContacts,
        resolveMnemonic: mnemonicHook.current,
        resolveHd: async () => null,
    })

    return { getItem, seenDeviceIds, hashAddress }
}

/** An account the backup holds that this device deliberately removed, which is
 *  the only state that puts a row under "Add from backup" with both buttons.
 *  The key is a hash, so `address` is what puts the row in the review bucket. */
const seedAvailableFromBackup = (
    address: string,
    hashAddress: ItemKeyHasher,
) => {
    const { backupId } = useCloudBackupStore.getState()
    useBackupSyncStateStore.getState().setSyncState({
        ...createEmptySyncState(backupId ?? 'did:pera:test'),
        items: {
            [accountItemKey(hashAddress(address))]: {
                type: BackupItemType.ACCOUNT,
                knownVer: 1,
                baseVer: 1,
                isDirty: false,
                status: BackupItemStatus.ACTIVE,
                lastRemoteHash: null,
                pendingImport: true,
                address,
            },
        },
    })
}

describe('Flow: Cloud backup → review actions while offline', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'bypass' })
        await setupTestDatabase()
    })

    afterEach(() => {
        server.resetHandlers()
        // `onlineManager` is process-wide: a test that left it offline would
        // fail every later file in the same worker.
        setConnected(true)
    })

    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset(NETWORK)
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore.getState().setDeviceID(NETWORK, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()
    })

    it(
        'Given a not-backed-up account, when Back Up is tapped offline, then it reports being offline and the account stays not backed up — and backs up once reconnected',
        async () => {
            await seedAlgo25Account()
            const { seenDeviceIds } = await setupBackup()

            renderWithNavigation(
                CloudBackupAccountsScreen,
                'CloudBackupAccounts',
            )

            const backUpButton = await screen.findByTestId(
                'cloud_backup_account_back_up',
            )

            setConnected(false)
            fireEvent.click(backUpButton)

            await waitFor(() =>
                expect(toastTitles()).toContain(
                    'errors.network.no_connection.title',
                ),
            )
            expect(toastTitles()).not.toContain(
                'cloud_backup.accounts.back_up_success',
            )
            expect(
                screen.getByTestId('backup_account_row_not_backed_up'),
            ).toBeTruthy()
            expect(seenDeviceIds()).toEqual([])

            setConnected(true)
            fireEvent.click(screen.getByTestId('cloud_backup_account_back_up'))

            await waitFor(() =>
                expect(toastTitles()).toContain(
                    'cloud_backup.accounts.back_up_success',
                ),
            )
            expect(
                await screen.findByTestId('backup_account_row_backed_up'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an account only the backup holds, when Add is tapped offline, then it reports being offline and the row stays available to add',
        async () => {
            const { seenDeviceIds, hashAddress } = await setupBackup()
            seedAvailableFromBackup(REMOTE_ONLY_ADDRESS, hashAddress)

            renderWithNavigation(
                CloudBackupAccountsReviewScreen,
                'CloudBackupAccountsReview',
            )

            const addButton = await screen.findByTestId(
                'add_from_backup_button',
            )

            setConnected(false)
            fireEvent.click(addButton)

            await waitFor(() =>
                expect(toastTitles()).toContain(
                    'errors.network.no_connection.title',
                ),
            )
            expect(toastTitles()).not.toContain(
                'cloud_backup.accounts.add_success',
            )
            expect(screen.getByTestId('add_from_backup_button')).toBeTruthy()
            expect(seenDeviceIds()).toEqual([])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an account only the backup holds, when Remove is confirmed offline, then it reports being offline and nothing is staged for deletion',
        async () => {
            const { seenDeviceIds, hashAddress } = await setupBackup()
            seedAvailableFromBackup(REMOTE_ONLY_ADDRESS, hashAddress)

            renderWithNavigation(
                CloudBackupAccountsReviewScreen,
                'CloudBackupAccountsReview',
            )

            setConnected(false)
            fireEvent.click(
                await screen.findByTestId('delete_from_backup_button'),
            )

            // Offline is reported after the confirmation, not instead of it:
            // the guard sits on the action, not on opening the sheet.
            fireEvent.click(
                await screen.findByTestId('delete_from_backup_confirm'),
            )

            await waitFor(() =>
                expect(toastTitles()).toContain(
                    'errors.network.no_connection.title',
                ),
            )
            expect(toastTitles()).not.toContain(
                'cloud_backup.accounts.delete_success',
            )
            expect(seenDeviceIds()).toEqual([])
            // A pendingDelete written here would drop the row out of the
            // backup's view on the strength of a request that never went out.
            expect(
                useBackupSyncStateStore.getState().syncState?.items[
                    accountItemKey(hashAddress(REMOTE_ONLY_ADDRESS))
                ]?.pendingDelete,
            ).not.toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
