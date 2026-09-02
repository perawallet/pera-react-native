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
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    DerivationTypes,
    useAccountsStore,
    type HDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    BackupAccountType,
    deriveBackupKeys,
    deleteBackupKeys,
    useCloudBackupStore,
    useBackupSyncStateStore,
    useCloudBackupRestoreDraftStore,
} from '@perawallet/wallet-core-backup'
import { buildRestoreHandlers } from '@perawallet/wallet-core-backup/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    encodeAlgorandAddress,
    useNetworkStore,
} from '@perawallet/wallet-core-blockchain'
import { hdDerivedKeyId, useKMS } from '@perawallet/wallet-core-kms'
import { bytesToHex } from '@perawallet/wallet-core-shared'

import { useResolveHdSeedForBackup } from '@modules/cloud-backup'
import { CloudBackupScreen } from '@modules/cloud-backup/screens/CloudBackupScreen'
import { CloudBackupRestorePassphraseScreen } from '@modules/cloud-backup/screens/CloudBackupRestorePassphraseScreen'
import { CloudBackupRestoreEncryptionKeyScreen } from '@modules/cloud-backup/screens/CloudBackupRestoreEncryptionKeyScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_MNEMONIC_24,
} from './__fixtures__/onboarding'

// The restore runs argon2 → HKDF → pull (manifest/delta/items-read) → AES-GCM
// decrypt → keystore commit → store rewrites, with a couple of screen
// transitions and a bottom sheet in between. Comfortably past the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

// Any twelve wordlist words: the cloud-backup KDF hashes the phrase and never
// checks a BIP39 checksum, so these don't need to form a valid mnemonic.
const BACKUP_MNEMONIC = [
    'abandon',
    'ability',
    'able',
    'about',
    'above',
    'absent',
    'absorb',
    'abstract',
    'absurd',
    'abuse',
    'access',
    'accident',
]

// Typed verbatim into the encryption-key input.
const BACKUP_SALT = Buffer.from(new Uint8Array(16).fill(7)).toString('base64')

const renderCloudBackupFlow = () =>
    renderWithNavigation(CloudBackupScreen, 'CloudBackupHome', {
        additionalScreens: [
            {
                name: 'CloudBackupRestorePassphrase',
                component: CloudBackupRestorePassphraseScreen,
            },
            {
                name: 'CloudBackupRestoreEncryptionKey',
                component: CloudBackupRestoreEncryptionKeyScreen,
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
        await screen.findByTestId('cloud_backup_restore_sheet_continue'),
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

describe('Flow: Cloud backup → Restore', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
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
    })

    it(
        'Given a valid backup passphrase and encryption key, when the user restores, then the encrypted Algo25 account is decrypted and imported into the wallet',
        async () => {
            const { backupId, encryptionKey } = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })

            // The handler encrypts each item with AES-256-GCM under
            // `encryptionKey`, so restore performs a real decrypt.
            server.use(
                ...buildRestoreHandlers({
                    backupId,
                    encryptionKey,
                    items: [
                        {
                            key: `accounts/${ALGO25_TEST_ADDRESS}`,
                            plaintext: JSON.stringify({
                                type: BackupAccountType.algo25,
                                address: ALGO25_TEST_ADDRESS,
                                customName: 'Restored',
                            }),
                        },
                        {
                            key: `secrets/${ALGO25_TEST_ADDRESS}`,
                            plaintext: JSON.stringify({
                                type: BackupAccountType.algo25,
                                mnemonic: ALGO25_TEST_MNEMONIC,
                            }),
                        },
                    ],
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
            // The custom name rode in the encrypted address payload.
            expect(restored?.name).toBe('Restored')

            expect(useBackupSyncStateStore.getState().syncState).not.toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an HD backup (hdWallet items + an hdSeed secret), when the user restores, then the seed is reconstructed and all HD accounts are imported',
        async () => {
            const { backupId, encryptionKey } = await deriveBackupKeys({
                mnemonic: BACKUP_MNEMONIC,
                salt: BACKUP_SALT,
            })

            // Build the fixtures with the producer's own resolver so the
            // server items are byte-for-byte what a push would have written.
            const { result: kms } = renderHook(() => useKMS())
            let seedKeyId = ''
            await waitFor(async () => {
                const seed = await kms.current.createHDWalletKey({
                    mnemonic: HD_TEST_MNEMONIC_24,
                })
                seedKeyId = seed!.seedKey.id ?? ''
                expect(seedKeyId).not.toBe('')
            })

            const hdAccount = (
                keyIndex: number,
                name: string,
            ): HDWalletAccount => ({
                id: `hd-0-${keyIndex}`,
                type: AccountTypes.hdWallet,
                address: '',
                keyPairId: hdDerivedKeyId(
                    seedKeyId,
                    0,
                    keyIndex,
                    BIP32DerivationType.Peikert,
                ),
                name,
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex,
                    derivationType: DerivationTypes.Peikert,
                },
            })

            const pub0 = await kms.current.getDerivedPublicKey(
                seedKeyId,
                0,
                0,
                BIP32DerivationType.Peikert,
            )
            const pub1 = await kms.current.getDerivedPublicKey(
                seedKeyId,
                0,
                1,
                BIP32DerivationType.Peikert,
            )
            const first = encodeAlgorandAddress(pub0)
            const second = encodeAlgorandAddress(pub1)

            const { result: hdResolver } = renderHook(() =>
                useResolveHdSeedForBackup(),
            )
            const resolved = await hdResolver.current(hdAccount(0, 'HD First'))
            expect(resolved).not.toBeNull()
            const { seedHex, entropyHex } = resolved!

            // Wipe the temp seed so restore imports into a clean keystore.
            resetTestKeystore()
            useAccountsStore.getState().setAccounts([])

            server.use(
                ...buildRestoreHandlers({
                    backupId,
                    encryptionKey,
                    items: [
                        {
                            key: `accounts/${first}`,
                            plaintext: JSON.stringify({
                                type: BackupAccountType.hdWallet,
                                address: first,
                                seedFirstDerivedAddress: first,
                                publicKey: bytesToHex(pub0),
                                account: 0,
                                change: 0,
                                keyIndex: 0,
                                derivationType: DerivationTypes.Peikert,
                                customName: 'HD First',
                            }),
                        },
                        {
                            key: `secrets/${first}`,
                            plaintext: JSON.stringify({
                                type: BackupAccountType.hdSeed,
                                seed: seedHex,
                                entropy: entropyHex,
                            }),
                        },
                        {
                            key: `accounts/${second}`,
                            plaintext: JSON.stringify({
                                type: BackupAccountType.hdWallet,
                                address: second,
                                seedFirstDerivedAddress: first,
                                publicKey: bytesToHex(pub1),
                                account: 0,
                                change: 0,
                                keyIndex: 1,
                                derivationType: DerivationTypes.Peikert,
                                customName: 'HD Second',
                            }),
                        },
                    ],
                }),
            )

            renderCloudBackupFlow()
            await runRestoreFlow()

            // Both children reconstructing proves the seed was persisted from
            // the hdSeed secret and re-derived back to their addresses.
            await waitFor(
                () => {
                    const addresses = useAccountsStore
                        .getState()
                        .accounts.map(a => a.address)
                    expect(addresses).toContain(first)
                    expect(addresses).toContain(second)
                },
                { timeout: 10_000 },
            )

            await waitFor(() => {
                expect(useCloudBackupStore.getState().isConfigured()).toBe(true)
            })

            const accounts = useAccountsStore.getState().accounts
            const firstAccount = accounts.find(a => a.address === first)
            const secondAccount = accounts.find(a => a.address === second)
            expect(firstAccount?.type).toBe(AccountTypes.hdWallet)
            expect(secondAccount?.type).toBe(AccountTypes.hdWallet)
            expect(firstAccount?.name).toBe('HD First')
            expect(secondAccount?.name).toBe('HD Second')

            expect(useBackupSyncStateStore.getState().syncState).not.toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
