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
    useCloudBackupImport,
    useCloudBackupStore,
    useBackupSyncStateStore,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
    initializeBackupSyncManager,
} from '@perawallet/wallet-core-backup'
import {
    buildSyncHandlers,
    decryptItemPayload,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    SLOW_TEST_TIMEOUT_MS,
    renderQueryHook,
    seedAlgo25Account,
    seedHDWalletAccounts,
} from './__fixtures__/cloudBackup'
import { ALGO25_TEST_MNEMONIC } from './__fixtures__/onboarding'

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
    const { backupId, encryptionKey, authSecretKey } = await deriveBackupKeys({
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
        deviceId,
    })

    const { handlers, getItem, seenDeviceIds } = buildSyncHandlers({ backupId })
    server.use(...handlers)

    const importHook = renderQueryHook(() => useCloudBackupImport())
    const mnemonicHook = renderQueryHook(() => useResolveMnemonicForBackup())
    const hdHook = withHdResolver
        ? renderQueryHook(() => useResolveHdSeedForBackup())
        : null

    const manager = initializeBackupSyncManager({
        importAccounts: importHook.current.importAccounts,
        resolveMnemonic: mnemonicHook.current,
        resolveHd: hdHook ? hdHook.current : async () => null,
    })

    return { manager, getItem, seenDeviceIds, backupId, encryptionKey }
}

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

            const { manager, getItem, backupId, encryptionKey } =
                await setupSyncedBackup()
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

            const { manager, seenDeviceIds } = await setupSyncedBackup({
                deviceId: 'registered-device',
            })
            useDeviceStore
                .getState()
                .setDeviceID(
                    useNetworkStore.getState().network,
                    'current-device',
                )
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

            const { manager, getItem, backupId, encryptionKey } =
                await setupSyncedBackup({ withHdResolver: true })
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
    it(
        'deletes the account from the server when the user chooses Delete',
        async () => {
            const account = await seedAlgo25Account()
            const { manager, getItem } = await setupSyncedBackup()

            await manager.syncNow()
            expect(getItem(`accounts/${account.address}`)).toBeDefined()

            expect(await manager.deleteAccountFromBackup(account.address)).toBe(
                true,
            )
            useAccountsStore.getState().setAccounts([])
            await manager.syncNow()

            expect(getItem(`accounts/${account.address}`)).toBeUndefined()
            expect(getItem(`secrets/${account.address}`)).toBeUndefined()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'leaves the server copy alone when the user chooses Keep it',
        async () => {
            const account = await seedAlgo25Account()
            const { manager, getItem } = await setupSyncedBackup()

            await manager.syncNow()
            expect(await manager.keepAccountInBackup(account.address)).toBe(
                true,
            )
            useAccountsStore.getState().setAccounts([])
            await manager.syncNow()

            expect(getItem(`accounts/${account.address}`)).toBeDefined()
            expect(getItem(`secrets/${account.address}`)).toBeDefined()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
    it(
        'keeps the server copy when an account leaves the device without a choice',
        async () => {
            const account = await seedAlgo25Account()
            const { manager, getItem } = await setupSyncedBackup()

            await manager.syncNow()
            expect(getItem(`accounts/${account.address}`)).toBeDefined()

            // No review action and no removal flow: the shape of a device wipe.
            useAccountsStore.getState().setAccounts([])
            await manager.syncNow()

            expect(getItem(`accounts/${account.address}`)).toBeDefined()
            expect(getItem(`secrets/${account.address}`)).toBeDefined()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
    it(
        'keeps the shared HD seed until its last account leaves the backup',
        async () => {
            const { first, second } = await seedHDWalletAccounts()
            const { manager, getItem } = await setupSyncedBackup({
                withHdResolver: true,
            })
            await manager.syncNow()

            // The seed rides under the FIRST derived address, so deleting that
            // account must not take the key material its sibling still needs.
            await manager.deleteAccountFromBackup(first.address)

            expect(getItem(`accounts/${first.address}`)).toBeUndefined()
            expect(getItem(`accounts/${second.address}`)).toBeDefined()
            expect(getItem(`secrets/${first.address}`)).toBeDefined()

            await manager.deleteAccountFromBackup(second.address)

            expect(getItem(`accounts/${second.address}`)).toBeUndefined()
            expect(getItem(`secrets/${first.address}`)).toBeUndefined()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
