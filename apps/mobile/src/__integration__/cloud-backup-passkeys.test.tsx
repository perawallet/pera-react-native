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
import {
    readMasterKey,
    resetTestKeystore,
    storage,
} from '@test-utils/algorand-keystore-test'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    createBackupSyncStoreSources,
    getBackupSyncManager,
    initializeBackupSyncManager,
    useBackupSyncStateStore,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupPasskeyImport,
    useCloudBackupRestoreDraftStore,
    useCloudBackupStore,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
    useResolveSeedEntropyForBackup,
} from '@perawallet/wallet-core-backup'
import {
    buildSyncHandlers,
    createItemKeyHasher,
    passkeyItemKey,
} from '@perawallet/wallet-core-backup/test-handlers'
import {
    nativePasskeyEntryExists,
    openNativeProviderRecord,
} from '@perawallet/wallet-core-passkeys'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'

import { CloudBackupScreen } from '@modules/cloud-backup/screens/CloudBackupScreen'
import { CloudBackupRestorePassphraseScreen } from '@modules/cloud-backup/screens/CloudBackupRestorePassphraseScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'
import { CloudBackupRestoreEncryptionKeyRoute } from '@modules/cloud-backup/routes'
import { useListPasskeysForBackup } from '@modules/cloud-backup'

// Not on the package barrel: nothing outside the engine encrypts an item, and
// only this file has to forge one the way another device would have written it.
import {
    decryptItemPayload,
    encryptItemPayload,
} from '../../../../packages/backup/src/cloud/crypto/itemPayload'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    SLOW_TEST_TIMEOUT_MS,
    renderQueryHook,
    seedHDWalletAccounts,
    seedPasskey,
} from './__fixtures__/cloudBackup'
const DEVICE_ID = 'test-device-id'

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

    expect(
        await screen.findByTestId('cloud_backup_overview_screen'),
    ).toBeTruthy()
}

/** The sync singleton with every real dependency the app injects, so a wiring
 *  gap between the engine and the mobile hooks fails here rather than on a
 *  device. */
const startRealSyncManager = () => {
    const importHook = renderQueryHook(() => useCloudBackupImport())
    const contactImportHook = renderQueryHook(() =>
        useCloudBackupContactImport(),
    )
    const hdHook = renderQueryHook(() => useResolveHdSeedForBackup())
    const mnemonicHook = renderQueryHook(() => useResolveMnemonicForBackup())
    const listHook = renderQueryHook(() => useListPasskeysForBackup())
    const passkeyImportHook = renderQueryHook(() =>
        useCloudBackupPasskeyImport(useResolveSeedEntropyForBackup()),
    )

    return initializeBackupSyncManager({
        sources: createBackupSyncStoreSources(),
        importAccounts: importHook.current.importAccounts,
        importContacts: contactImportHook.current.importContacts,
        resolveHd: hdHook.current,
        resolveMnemonic: mnemonicHook.current,
        listPasskeys: listHook.current,
        importPasskeys: passkeyImportHook.current.importPasskeys,
        subscribePasskeyChanges: () => () => {},
    })
}

/** Returns the item-key hasher, because every key a test asserts on is an
 *  HMAC of the credential id under K_item and cannot be rebuilt without it. */
const configureBackup = async (keys: {
    backupId: string
    encryptionKey: Uint8Array
    authSecretKey: Uint8Array
    itemKey: Uint8Array
}) => {
    await persistBackupKeys({
        encryptionKey: keys.encryptionKey,
        authSecretKey: keys.authSecretKey,
        itemKey: keys.itemKey,
        mnemonic: BACKUP_MNEMONIC,
    })
    useCloudBackupStore.getState().setConfigured({
        backupId: keys.backupId,
        salt: BACKUP_SALT,
        deviceId: DEVICE_ID,
    })
    return createItemKeyHasher(keys.itemKey)
}

/** Everything the restore has to put back; the fake backend keeps what the
 *  push left behind. */
const wipeDevice = async () => {
    resetTestKeystore()
    useAccountsStore.getState().setAccounts([])
    useCloudBackupStore.getState().resetState()
    useBackupSyncStateStore.getState().resetState()
    await deleteBackupKeys().catch(() => undefined)
}

const restoredPublicKey = async (credentialId: string): Promise<number[]> => {
    const record = (await openNativeProviderRecord(
        globalThis.crypto.subtle,
        await readMasterKey(),
        storage.getString(credentialId)!,
    )) as { publicKey: number[] }
    return record.publicKey
}

describe('Flow: Cloud backup → Passkeys', () => {
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
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, DEVICE_ID)
        await deleteBackupKeys().catch(() => undefined)
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(File.pickFileAsync).mockReset()
    })

    it(
        'Given a passkey derived from a backed-up seed, when the device is wiped and restored, then the credential is rewritten with the same public key',
        async () => {
            const keys = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })
            const { seedKeyId } = await seedHDWalletAccounts()
            const passkey = await seedPasskey({ seedKeyId })
            const hashAddress = await configureBackup(keys)

            const { handlers, getItem } = buildSyncHandlers({
                backupId: keys.backupId,
            })
            server.use(...handlers)
            await startRealSyncManager().syncNow()

            expect(
                getItem(passkeyItemKey(hashAddress(passkey.credentialId))),
            ).toBeDefined()
            // Precondition for the post-restore assertion below: the pushing
            // device holds the credential in the keystore, never as a native
            // provider record, so only the restore can put one there.
            expect(nativePasskeyEntryExists(passkey.credentialId)).toBe(false)

            await wipeDevice()
            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(
                () => {
                    expect(nativePasskeyEntryExists(passkey.credentialId)).toBe(
                        true,
                    )
                },
                { timeout: 10_000 },
            )
            expect(await restoredPublicKey(passkey.credentialId)).toEqual(
                Array.from(decodeFromBase64(passkey.publicKeySpkiDer)),
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // The case a device-wide passkey main key would have broken: the credential
    // belongs to the second wallet's seed, not the first's.
    it(
        'Given two wallets on the device, when a credential derived from the second is restored, then it still round-trips',
        async () => {
            const keys = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })
            await seedHDWalletAccounts()
            const { seedKeyId: secondSeedKeyId } = await seedHDWalletAccounts({
                isAdditionalWallet: true,
            })
            const passkey = await seedPasskey({
                seedKeyId: secondSeedKeyId,
                origin: 'second.example',
            })
            const hashAddress = await configureBackup(keys)

            const { handlers, getItem } = buildSyncHandlers({
                backupId: keys.backupId,
            })
            server.use(...handlers)
            await startRealSyncManager().syncNow()

            expect(
                getItem(passkeyItemKey(hashAddress(passkey.credentialId))),
            ).toBeDefined()

            await wipeDevice()
            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(
                () => {
                    expect(nativePasskeyEntryExists(passkey.credentialId)).toBe(
                        true,
                    )
                },
                { timeout: 10_000 },
            )
            expect(await restoredPublicKey(passkey.credentialId)).toEqual(
                Array.from(decodeFromBase64(passkey.publicKeySpkiDer)),
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // A credential id is standard base64, so it routinely carries `/` and `+`.
    // Those reach the per-item URL, which no account or contact key could ever
    // exercise: their ids are base32 Algorand addresses.
    it(
        'Given a backed-up credential, when the user deletes it from the backup, then the item is removed server-side',
        async () => {
            const keys = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })
            const { seedKeyId } = await seedHDWalletAccounts()
            const passkey = await seedPasskey({ seedKeyId })
            const hashAddress = await configureBackup(keys)

            const { handlers, getItem } = buildSyncHandlers({
                backupId: keys.backupId,
            })
            server.use(...handlers)
            await startRealSyncManager().syncNow()

            const itemKey = passkeyItemKey(hashAddress(passkey.credentialId))
            expect(getItem(itemKey)?.status).toBe('ACTIVE')

            const outcome =
                await getBackupSyncManager().deletePasskeyFromBackup(
                    passkey.credentialId,
                )

            expect(outcome).toBe('settled')
            expect(getItem(itemKey)?.status).not.toBe('ACTIVE')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a backed-up credential whose stored public key was tampered with, when the device is restored, then nothing is written and the item is still tracked',
        async () => {
            const keys = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })
            const { seedKeyId } = await seedHDWalletAccounts()
            const passkey = await seedPasskey({ seedKeyId })
            const hashAddress = await configureBackup(keys)

            const { handlers, getItem, pushFromOtherDevice } =
                buildSyncHandlers({ backupId: keys.backupId })
            server.use(...handlers)
            await startRealSyncManager().syncNow()

            const itemKey = passkeyItemKey(hashAddress(passkey.credentialId))
            const ctx = {
                encryptionKey: keys.encryptionKey,
                backupId: keys.backupId,
                key: itemKey,
            }
            const payload = JSON.parse(
                decryptItemPayload(getItem(itemKey)!.payload, ctx),
            ) as { publicKeySpkiDer: string }
            payload.publicKeySpkiDer = encodeToBase64(new Uint8Array(91))
            pushFromOtherDevice(
                itemKey,
                encryptItemPayload(JSON.stringify(payload), ctx),
            )

            await wipeDevice()
            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(() => {
                expect(
                    useBackupSyncStateStore.getState().syncState,
                ).not.toBeNull()
            })
            expect(nativePasskeyEntryExists(passkey.credentialId)).toBe(false)
            // Tracked at the version the server holds, so the next push is not
            // refused for offering a known item as new.
            const tracked =
                useBackupSyncStateStore.getState().syncState?.items[itemKey]
            expect(tracked?.knownVer).toBeGreaterThan(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
    // A positive control in the same run: the orphan and the provable
    // credential travel in one backup, so "nothing was written" cannot pass by
    // the import never running. The orphan's public key is genuinely derived,
    // so a missing seed is the only reason it can be skipped.
    it(
        'Given a credential whose owning seed is not in the backup, when the device is restored, then it alone is skipped',
        async () => {
            const keys = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })

            // The orphan's wallet is derived and then wiped before the backup
            // is configured, so the engine never sees it. The manager watches
            // the accounts store, so leaving it on the device would have it
            // push the secret and give the credential a seed after all.
            const { seedKeyId: orphanSeedKeyId } = await seedHDWalletAccounts()
            const orphan = await seedPasskey({
                seedKeyId: orphanSeedKeyId,
                origin: 'orphan.example',
            })
            await wipeDevice()

            const { seedKeyId } = await seedHDWalletAccounts({
                isAdditionalWallet: true,
            })
            const backedUp = await seedPasskey({ seedKeyId })
            const hashAddress = await configureBackup(keys)

            const { handlers, getItem, pushFromOtherDevice } =
                buildSyncHandlers({
                    backupId: keys.backupId,
                })
            server.use(...handlers)
            await startRealSyncManager().syncNow()

            const orphanKey = passkeyItemKey(hashAddress(orphan.credentialId))
            pushFromOtherDevice(
                orphanKey,
                encryptItemPayload(
                    JSON.stringify({
                        credentialId: orphan.credentialId,
                        origin: 'orphan.example',
                        identity: 'user@example.com',
                        counter: 0,
                        publicKeySpkiDer: orphan.publicKeySpkiDer,
                        seedAddress: orphan.seedAddress,
                        createdAt: 1,
                        updatedAt: 1,
                    }),
                    {
                        encryptionKey: keys.encryptionKey,
                        backupId: keys.backupId,
                        key: orphanKey,
                    },
                ),
            )

            // The orphan wallet must never have reached the backup, or the
            // restore would have a seed to re-derive from after all.
            expect(getItem(`secrets/${orphan.seedAddress}`)).toBeUndefined()

            await wipeDevice()
            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(
                () => {
                    expect(
                        nativePasskeyEntryExists(backedUp.credentialId),
                    ).toBe(true)
                },
                { timeout: 10_000 },
            )
            expect(nativePasskeyEntryExists(orphan.credentialId)).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
