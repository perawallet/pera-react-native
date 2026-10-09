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
    SETTINGS_ITEM_ID,
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupStore,
    useBackupSyncStateStore,
    useResolveMnemonicForBackup,
    createBackupSyncStoreSources,
    initializeBackupSyncManager,
} from '@perawallet/wallet-core-backup'
import {
    buildSyncHandlers,
    createItemKeyHasher,
    decryptItemPayload,
    encryptItemPayload,
    settingsItemKey,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useSettingsStore } from '@perawallet/wallet-core-settings'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    renderQueryHook,
} from './__fixtures__/cloudBackup'

const setupSyncedBackup = async () => {
    const { backupId, encryptionKey, authSecretKey, itemKey } =
        await deriveBackupKeys({
            mnemonic: BACKUP_MNEMONIC,
            salt: BACKUP_SALT,
        })
    const key = settingsItemKey(createItemKeyHasher(itemKey)(SETTINGS_ITEM_ID))
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

    const { handlers, getItem, pushFromOtherDevice } = buildSyncHandlers({
        backupId,
    })
    server.use(...handlers)

    const importHook = renderQueryHook(() =>
        useCloudBackupImport(useSelectedScope(LEGACY_CHAIN_ID)),
    )
    const contactImportHook = renderQueryHook(() =>
        useCloudBackupContactImport(),
    )
    const mnemonicHook = renderQueryHook(() => useResolveMnemonicForBackup())

    const manager = initializeBackupSyncManager({
        sources: createBackupSyncStoreSources(),
        importAccounts: importHook.current.importAccounts,
        importContacts: contactImportHook.current.importContacts,
        resolveMnemonic: mnemonicHook.current,
        resolveHd: async () => null,
        isLocked: () => false,
        listPasskeys: async () => [],
        importPasskeys: async () => ({ imported: 0, skipped: [], failed: [] }),
        subscribePasskeyChanges: () => () => {},
    })

    const codec = { encryptionKey, backupId, key }
    return {
        manager,
        remoteSettings: () => {
            const item = getItem(key)
            return item
                ? JSON.parse(decryptItemPayload(item.payload, codec))
                : undefined
        },
        pushSettingsFromOtherDevice: (payload: Record<string, unknown>) =>
            pushFromOtherDevice(
                key,
                encryptItemPayload(JSON.stringify(payload), codec),
            ),
    }
}

describe('Flow: Cloud backup → Settings sync', () => {
    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.getState().resetState()
        useCurrenciesStore.getState().resetState()
        useSettingsStore.getState().resetState()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()
    })

    it('backs up this device settings, stamped as never edited', async () => {
        const { manager, remoteSettings } = await setupSyncedBackup()

        await manager.syncNow()

        expect(remoteSettings()).toEqual({
            currency: {
                value: { preferred: 'USD', fallback: 'USD' },
                updatedAt: 0,
            },
            language: { value: 'system', updatedAt: 0 },
            confirmationMode: { value: 'slide', updatedAt: 0 },
            launchAccount: {
                value: { mode: 'lastUsed', address: null },
                updatedAt: 0,
            },
        })
    })

    it('adopts a setting another device chose instead of overwriting it with a default', async () => {
        const { manager, remoteSettings, pushSettingsFromOtherDevice } =
            await setupSyncedBackup()
        pushSettingsFromOtherDevice({
            currency: {
                value: { preferred: 'EUR', fallback: 'ALGO' },
                updatedAt: 10,
            },
        })

        await manager.syncNow()

        expect(useCurrenciesStore.getState()).toMatchObject({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'ALGO',
        })
        expect(remoteSettings().currency).toEqual({
            value: { preferred: 'EUR', fallback: 'ALGO' },
            updatedAt: 10,
        })
    })

    it('keeps both devices edits when they change different settings', async () => {
        const { manager, remoteSettings, pushSettingsFromOtherDevice } =
            await setupSyncedBackup()
        await manager.syncNow()

        useSettingsStore.getState().setLanguage('tr')
        pushSettingsFromOtherDevice({
            ...remoteSettings(),
            currency: {
                value: { preferred: 'EUR', fallback: 'ALGO' },
                updatedAt: 10,
            },
        })
        await manager.syncNow()

        expect(useSettingsStore.getState().language).toBe('tr')
        expect(useCurrenciesStore.getState().preferredCurrency).toBe('EUR')
        expect(remoteSettings()).toMatchObject({
            language: { value: 'tr' },
            currency: { value: { preferred: 'EUR', fallback: 'ALGO' } },
        })
        expect(
            Object.values(
                useBackupSyncStateStore.getState().syncState?.items ?? {},
            ).some(item => item.isDirty),
        ).toBe(false)
    })
})
