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
import { expect } from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    buildAccount,
    deriveHdAccount,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useKMS,
    entropyChildIdOf,
    withSecret,
} from '@perawallet/wallet-core-kms'
import {
    getSelectedScope,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    createBackupSyncStoreSources,
    deleteBackupKeys,
    initializeBackupSyncManager,
    persistBackupKeys,
    useBackupSyncStateStore,
    useCloudBackupContactImport,
    useCloudBackupImport,
    useCloudBackupPasskeyImport,
    useCloudBackupStore,
    useListPasskeysForBackup,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
    useResolveSeedEntropyForBackup,
} from '@perawallet/wallet-core-backup'
import { createItemKeyHasher } from '@perawallet/wallet-core-backup/test-handlers'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '@perawallet/wallet-core-passkeys'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { CloudBackupRestoreEncryptionKeyRoute } from '@modules/cloud-backup/routes'
import { CloudBackupScreen } from '@modules/cloud-backup/screens/CloudBackupScreen'
import { CloudBackupRestorePassphraseScreen } from '@modules/cloud-backup/screens/CloudBackupRestorePassphraseScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_MNEMONIC_24_ALT_INDICES,
    HD_TEST_MNEMONIC_24_INDICES,
} from './onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './timeouts'

// Any twelve wordlist words: the cloud-backup KDF hashes the phrase and never
// checks a BIP39 checksum, so these don't need to form a valid mnemonic.
export const BACKUP_MNEMONIC = [
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

export const BACKUP_SALT = Buffer.from(new Uint8Array(16).fill(7)).toString(
    'base64',
)

export const DEVICE_ID = 'test-device-id'

export const renderCloudBackupFlow = () =>
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

export const runRestoreFlow = async () => {
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
        await screen.findByTestId(
            'cloud_backup_overview_screen',
            {},
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        ),
    ).toBeTruthy()
}

/** The sync singleton with every real dependency the app injects, so a wiring
 *  gap between the engine and the mobile hooks fails here rather than on a
 *  device. */
export const startRealSyncManager = () => {
    const importHook = renderQueryHook(() =>
        useCloudBackupImport(useSelectedScope(ALGORAND_CHAIN_ID)),
    )
    const contactImportHook = renderQueryHook(() =>
        useCloudBackupContactImport(),
    )
    const hdHook = renderQueryHook(() =>
        useResolveHdSeedForBackup(ALGORAND_CHAIN_ID),
    )
    const mnemonicHook = renderQueryHook(() =>
        useResolveMnemonicForBackup(ALGORAND_CHAIN_ID),
    )
    const listHook = renderQueryHook(() =>
        useListPasskeysForBackup(ALGORAND_CHAIN_ID),
    )
    const passkeyImportHook = renderQueryHook(() =>
        useCloudBackupPasskeyImport(
            ALGORAND_CHAIN_ID,
            useResolveSeedEntropyForBackup(ALGORAND_CHAIN_ID),
        ),
    )

    return initializeBackupSyncManager({
        chainId: ALGORAND_CHAIN_ID,
        sources: createBackupSyncStoreSources(ALGORAND_CHAIN_ID),
        importAccounts: importHook.current.importAccounts,
        importContacts: contactImportHook.current.importContacts,
        resolveHd: hdHook.current,
        resolveMnemonic: mnemonicHook.current,
        listPasskeys: listHook.current,
        importPasskeys: passkeyImportHook.current.importPasskeys,
        isLocked: () => false,
        subscribePasskeyChanges: () => () => {},
    })
}

/** Returns the item-key hasher, because every key a test asserts on is an
 *  HMAC of the credential id under K_item and cannot be rebuilt without it. */
export const configureBackup = async (keys: {
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
export const wipeDevice = async () => {
    resetTestKeystore()
    useAccountsStore.getState().setAccounts([])
    useCloudBackupStore.getState().resetState()
    useBackupSyncStateStore.getState().resetState()
    await deleteBackupKeys().catch(() => undefined)
}

/** A real keystore key rather than a stub: the sync engine reveals it back out
 *  of the keystore to build the account's secrets item. */
export const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    const key = await kms.current.createAlgo25Key({
        mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
    })
    expect(key).not.toBeNull()
    const account = buildAccount({
        id: 'algo25-1',
        name: 'Algo25 Test',
        custody: { kind: 'local', seed: null },
        chainId: ALGORAND_CHAIN_ID,
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: ALGO25_TEST_ADDRESS,
                keyPairId: key!.seedKey.id ?? '',
            },
        },
    })
    useAccountsStore.getState().setAccounts([account])
    return account
}

/** Each account's `keyPairId` has to be the derived child id, so `seedIdOf`
 *  can walk from the account back to its seed. */
export const seedHDWalletAccounts = async (params?: {
    /** A second, unrelated wallet: seeded from the alternate pinned mnemonic
     *  and appended to the accounts already on the device. Reusing the first
     *  mnemonic would give both wallets the same entropy and the same
     *  first-derived address, which is exactly what a multi-seed test has to
     *  tell apart. */
    isAdditionalWallet?: boolean
    /** Seeds this exact phrase instead; wins over `isAdditionalWallet`'s alternate vector. */
    mnemonicIndices?: Uint16Array
}): Promise<{
    first: WalletAccount
    second: WalletAccount
    seedKeyId: string
}> => {
    const { result: kms } = renderHook(() => useKMS())
    const seed = await kms.current.createHDWalletKey({
        mnemonicIndices:
            params?.mnemonicIndices ??
            (params?.isAdditionalWallet
                ? HD_TEST_MNEMONIC_24_ALT_INDICES
                : HD_TEST_MNEMONIC_24_INDICES),
    })
    expect(seed).not.toBeNull()
    const seedKeyId = seed!.seedKey.id ?? ''
    expect(seedKeyId).not.toBe('')

    const make = async (
        account: number,
        keyIndex: number,
        name: string,
    ): Promise<WalletAccount> => {
        const derived = await deriveHdAccount(
            getSelectedScope(ALGORAND_CHAIN_ID),
            seedKeyId,
            { account, keyIndex },
        )
        return buildAccount({
            // Scoped to the seed so a second wallet's accounts don't collide
            // with the first's on `id`.
            id: `hd-${seedKeyId}-${account}-${keyIndex}`,
            name,
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account, keyIndex },
            },
            chainId: ALGORAND_CHAIN_ID,
            chains: {
                [ALGORAND_CHAIN_ID]: {
                    address: derived.address,
                    keyPairId: derived.keyPairId,
                },
            },
        })
    }

    const first = await make(0, 0, 'HD First')
    const second = await make(0, 1, 'HD Second')
    const existing = params?.isAdditionalWallet
        ? useAccountsStore.getState().accounts
        : []
    useAccountsStore.getState().setAccounts([...existing, first, second])
    return { first, second, seedKeyId }
}

type KeystoreKey = ReturnType<typeof getKeystoreStore>['state']['keys'][number]

const PASSKEY_KEY_TYPE = 'hd-derived-p256'

/** A credential derived from a seed's own entropy, hydrated into the keystore
 *  store the way the wallet's own engine writes one: the derivation identity
 *  stored verbatim under `userHandle`, and the public key as SPKI DER. iOS
 *  instead stores the handle bytes standard-base64 and the extension stores a
 *  raw 64-byte point, so those two writers' shapes are covered by
 *  `passkeyBackup.spec.ts` rather than end to end here. */
export const seedPasskey = async (params: {
    seedKeyId: string
    origin?: string
    /** Fed to the domain-key derivation verbatim, so it must already be the
     *  lowercased form `identityCandidates` produces. */
    identity?: string
}): Promise<{
    credentialId: string
    seedAddress: string
    publicKeySpkiDer: string
}> => {
    const {
        seedKeyId,
        origin = 'example.com',
        identity = 'user@example.com',
    } = params
    const entropyId = entropyChildIdOf(seedKeyId, getKeystoreStore().state.keys)
    expect(entropyId).toBeTruthy()
    const entropy = await withSecret(entropyId!, bytes => new Uint8Array(bytes))
    expect(entropy).not.toBeNull()

    const mainKey = await derivePasskeyMainKey(entropy!)
    const derived = await derivePasskeyCredential({
        mainKey,
        origin,
        identity,
        counter: 0,
    })

    getKeystoreStore().setState(state => ({
        ...state,
        keys: [
            ...state.keys,
            {
                id: derived.credentialId,
                type: PASSKEY_KEY_TYPE,
                algorithm: 'P256',
                publicKey: derived.publicKeySpkiDer,
                metadata: {
                    origin,
                    userName: identity,
                    userHandle: identity,
                    parentKeyId: `${seedKeyId}-passkey-main`,
                    counter: 0,
                    createdAt: Date.now(),
                },
            } as unknown as KeystoreKey,
        ],
    }))

    const firstDerived = await deriveHdAccount(
        getSelectedScope(ALGORAND_CHAIN_ID),
        seedKeyId,
        { account: 0, keyIndex: 0 },
    )

    return {
        credentialId: derived.credentialId,
        seedAddress: firstDerived.address,
        publicKeySpkiDer: encodeToBase64(derived.publicKeySpkiDer),
    }
}

export const renderQueryHook = <T,>(hook: () => T) => {
    const queryClient: QueryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    return renderHook(hook, { wrapper }).result
}
