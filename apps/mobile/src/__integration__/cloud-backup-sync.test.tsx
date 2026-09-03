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
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    BackupAccountType,
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    useCloudBackupStore,
    useBackupSyncStateStore,
    initializeBackupSyncManager,
} from '@perawallet/wallet-core-backup'
import {
    buildSyncHandlers,
    decryptItemPayload,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    useCloudBackupImport,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
} from '@modules/cloud-backup'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    SLOW_TEST_TIMEOUT_MS,
    renderQueryHook,
    seedAlgo25Account,
    seedHDWalletAccounts,
} from './__fixtures__/cloudBackup'
import { ALGO25_TEST_MNEMONIC } from './__fixtures__/onboarding'

describe('Flow: Cloud backup → Sync (push round-trip)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()
    })

    it(
        'pushes a local Algo25 account: address + decryptable secret land on the backend, sync state recorded',
        async () => {
            const account = await seedAlgo25Account()

            const { backupId, encryptionKey, authSecretKey } =
                await deriveBackupKeys({
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                })

            await persistBackupKeys({
                encryptionKey,
                authSecretKey,
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
            const mnemonicHook = renderQueryHook(() =>
                useResolveMnemonicForBackup(),
            )

            const manager = initializeBackupSyncManager({
                importAccounts: importHook.current.importAccounts,
                resolveMnemonic: mnemonicHook.current,
                resolveHd: async () => null,
            })
            await manager.syncNow()

            const addressKey = `accounts/${account.address}`
            const secretsKey = `secrets/${account.address}`
            expect(getItem(addressKey)).toBeDefined()

            const secretItem = getItem(secretsKey)
            expect(secretItem).toBeDefined()
            const plaintext = decryptItemPayload(secretItem!.payload, {
                encryptionKey,
                backupId,
                key: secretsKey,
            })
            expect(JSON.parse(plaintext)).toMatchObject({
                type: BackupAccountType.algo25,
                mnemonic: ALGO25_TEST_MNEMONIC,
            })

            const syncState = useBackupSyncStateStore.getState().syncState
            expect(syncState?.lastSyncResult).toBe('SUCCESS')
            expect(syncState?.items[addressKey]).toMatchObject({
                isDirty: false,
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'signs with the device id the backup was registered under, not the current one in the device store',
        async () => {
            await seedAlgo25Account()

            const { backupId, encryptionKey, authSecretKey } =
                await deriveBackupKeys({
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                })
            await persistBackupKeys({
                encryptionKey,
                authSecretKey,
                mnemonic: BACKUP_MNEMONIC,
            })
            useCloudBackupStore.getState().setConfigured({
                backupId,
                salt: BACKUP_SALT,
                deviceId: 'registered-device',
            })
            useDeviceStore
                .getState()
                .setDeviceID(
                    useNetworkStore.getState().network,
                    'current-device',
                )

            const { handlers, seenDeviceIds } = buildSyncHandlers({ backupId })
            server.use(...handlers)

            const importHook = renderQueryHook(() => useCloudBackupImport())
            const mnemonicHook = renderQueryHook(() =>
                useResolveMnemonicForBackup(),
            )

            const manager = initializeBackupSyncManager({
                importAccounts: importHook.current.importAccounts,
                resolveMnemonic: mnemonicHook.current,
                resolveHd: async () => null,
            })
            await manager.syncNow()

            expect(
                useBackupSyncStateStore.getState().syncState?.lastSyncResult,
            ).toBe('SUCCESS')
            expect(seenDeviceIds().length).toBeGreaterThan(0)
            expect(new Set(seenDeviceIds())).toEqual(
                new Set(['registered-device']),
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'pushes HD accounts: one hdWallet item per account + a single hdSeed secret',
        async () => {
            const { first, second } = await seedHDWalletAccounts()

            const { backupId, encryptionKey, authSecretKey } =
                await deriveBackupKeys({
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                })
            await persistBackupKeys({
                encryptionKey,
                authSecretKey,
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
            const resolverHook = renderQueryHook(() =>
                useResolveHdSeedForBackup(),
            )
            const mnemonicHook = renderQueryHook(() =>
                useResolveMnemonicForBackup(),
            )

            const manager = initializeBackupSyncManager({
                importAccounts: importHook.current.importAccounts,
                resolveMnemonic: mnemonicHook.current,
                resolveHd: resolverHook.current,
            })
            await manager.syncNow()

            expect(getItem(`accounts/${first.address}`)).toBeDefined()
            expect(getItem(`accounts/${second.address}`)).toBeDefined()
            expect(getItem(`secrets/${second.address}`)).toBeUndefined()

            const seedItem = getItem(`secrets/${first.address}`)
            expect(seedItem).toBeDefined()
            const plaintext = decryptItemPayload(seedItem!.payload, {
                encryptionKey,
                backupId,
                key: `secrets/${first.address}`,
            })
            expect(JSON.parse(plaintext)).toMatchObject({
                type: BackupAccountType.hdSeed,
            })

            const addrItem = getItem(`accounts/${first.address}`)!
            const addrPlain = decryptItemPayload(addrItem.payload, {
                encryptionKey,
                backupId,
                key: `accounts/${first.address}`,
            })
            expect(JSON.parse(addrPlain)).toMatchObject({
                type: BackupAccountType.hdWallet,
                seedFirstDerivedAddress: first.address,
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
