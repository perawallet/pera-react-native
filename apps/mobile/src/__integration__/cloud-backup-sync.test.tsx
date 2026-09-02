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

import React from 'react'
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
import { renderHook, waitFor } from '@testing-library/react'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

import { createTestQueryClient } from '@test-utils/render'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    DerivationTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useKMS,
    hdDerivedKeyId,
    type Algo25KeyResult,
} from '@perawallet/wallet-core-kms'
import {
    encodeAlgorandAddress,
    useNetworkStore,
} from '@perawallet/wallet-core-blockchain'
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
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_MNEMONIC_24,
} from './__fixtures__/onboarding'

// The push round-trip runs argon2 → HKDF → keystore reveal → AES-256-GCM
// encrypt → upsert. Comfortably past the 5s default.
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

const BACKUP_SALT = Buffer.from(new Uint8Array(16).fill(7)).toString('base64')

// Mint a real Algo25 key from the pinned test mnemonic so the keystore can
// later reveal it to the sync engine, and register the account.
const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(key).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'algo25-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Algo25 Test',
    }
    useAccountsStore.getState().setAccounts([account])
    return account
}

// The derived child key id is the accounts' `keyPairId` so `seedIdOf` (used by
// the HD resolver) can walk back to the seed.
const seedHDWalletAccounts = async (): Promise<{
    first: WalletAccount
    second: WalletAccount
}> => {
    const { result: kms } = renderHook(() => useKMS())
    let seedKeyId = ''
    await waitFor(async () => {
        const seed = await kms.current.createHDWalletKey({
            mnemonic: HD_TEST_MNEMONIC_24,
        })
        expect(seed).not.toBeNull()
        seedKeyId = seed!.seedKey.id ?? ''
        expect(seedKeyId).not.toBe('')
    })

    const make = async (
        account: number,
        keyIndex: number,
        name: string,
    ): Promise<WalletAccount> => {
        const pub = await kms.current.getDerivedPublicKey(
            seedKeyId,
            account,
            keyIndex,
            BIP32DerivationType.Peikert,
        )
        return {
            id: `hd-${account}-${keyIndex}`,
            type: AccountTypes.hdWallet,
            address: encodeAlgorandAddress(pub),
            keyPairId: hdDerivedKeyId(
                seedKeyId,
                account,
                keyIndex,
                BIP32DerivationType.Peikert,
            ),
            name,
            hdWalletDetails: {
                account,
                change: 0,
                keyIndex,
                derivationType: DerivationTypes.Peikert,
            },
        }
    }

    const first = await make(0, 0, 'HD First')
    const second = await make(0, 1, 'HD Second')
    useAccountsStore.getState().setAccounts([first, second])
    return { first, second }
}

const renderQueryHook = <T,>(hook: () => T) => {
    const queryClient: QueryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    return renderHook(hook, { wrapper }).result
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

            const { backupId, encryptionKey, authSecretKey } =
                await deriveBackupKeys({
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                })

            // `withBackupEncryptionKey` (inside syncNow) reads these back out
            // of the keystore, so the engine and this test share one key.
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
            expect(getItem(secretsKey)).toBeDefined()

            // Decrypting back to the original 25-word phrase is the real
            // validation of the push round-trip.
            const secretItem = getItem(secretsKey)!
            const plaintext = decryptItemPayload(secretItem.payload, {
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

            // Each child gets its own address item; neither carries a personal
            // secret.
            expect(getItem(`accounts/${first.address}`)).toBeDefined()
            expect(getItem(`accounts/${second.address}`)).toBeDefined()
            expect(getItem(`secrets/${second.address}`)).toBeUndefined()

            // The seed is stored exactly once, at the first-derived slot.
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
