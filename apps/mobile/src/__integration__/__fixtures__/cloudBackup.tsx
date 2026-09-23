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
import { renderHook } from '@testing-library/react'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

import { createTestQueryClient } from '@test-utils/render'
import {
    AccountTypes,
    DerivationTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useKMS,
    hdDerivedKeyId,
    entropyChildIdOf,
    withSecret,
} from '@perawallet/wallet-core-kms'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '@perawallet/wallet-core-passkeys'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_MNEMONIC_24_INDICES,
} from './onboarding'

// argon2 → HKDF → keystore reveal → AES-256-GCM on every round-trip, so the
// 5s default is nowhere near enough.
export const SLOW_TEST_TIMEOUT_MS = 30_000

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

/** A real keystore key rather than a stub: the sync engine reveals it back out
 *  of the keystore to build the account's secrets item. */
export const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    const key = await kms.current.createAlgo25Key({
        mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
    })
    expect(key).not.toBeNull()
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

/** Each account's `keyPairId` has to be the derived child id, so `seedIdOf`
 *  can walk from the account back to its seed. */
export const seedHDWalletAccounts = async (params?: {
    /** Omitted for a second, unrelated wallet: the key is generated at random. */
    mnemonicIndices?: Uint16Array
    shouldReplaceAccounts?: boolean
}): Promise<{
    first: WalletAccount
    second: WalletAccount
    seedKeyId: string
}> => {
    const { result: kms } = renderHook(() => useKMS())
    const seed = await kms.current.createHDWalletKey({
        mnemonicIndices: params?.mnemonicIndices ?? HD_TEST_MNEMONIC_24_INDICES,
    })
    expect(seed).not.toBeNull()
    const seedKeyId = seed!.seedKey.id ?? ''
    expect(seedKeyId).not.toBe('')

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
            // Scoped to the seed so a second wallet's accounts don't collide
            // with the first's on `id`.
            id: `hd-${seedKeyId}-${account}-${keyIndex}`,
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
    const existing =
        params?.shouldReplaceAccounts === false
            ? useAccountsStore.getState().accounts
            : []
    useAccountsStore.getState().setAccounts([...existing, first, second])
    return { first, second, seedKeyId }
}

type KeystoreKey = ReturnType<typeof getKeystoreStore>['state']['keys'][number]

const PASSKEY_KEY_TYPE = 'hd-derived-p256'

/** A credential derived from a seed's own entropy, hydrated into the keystore
 *  store the way the credential provider hydrates one it minted — this is the
 *  only shape `passkeyBackupInputs` can prove reproducible. */
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
    const { result: kms } = renderHook(() => useKMS())

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

    const firstDerived = await kms.current.getDerivedPublicKey(
        seedKeyId,
        0,
        0,
        BIP32DerivationType.Peikert,
    )

    return {
        credentialId: derived.credentialId,
        seedAddress: encodeAlgorandAddress(firstDerived),
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
