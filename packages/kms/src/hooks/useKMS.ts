/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo } from 'react'
import type { Key } from '@algorandfoundation/keystore'
import {
    InvalidKeyError,
    KeyManagementError,
    KeyNotFoundError,
} from '../errors'
import { zeroBytes } from '../crypto/secure-memory'
import {
    expiresAtOf,
    hexToBytes,
    isSeedKey,
    seedSchemeOf,
    type SeedMetadata,
} from '../utils'
import { SeedScheme } from '../constants'
import { useAlgo25 } from './useAlgo25'
export type { Algo25KeyResult } from './useAlgo25'
import { useHDWallet } from './useHDWallet'
export type { HDWalletKeyResult } from './useHDWallet'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { useKMSService } from './useKMSServices'
import { useKeystoreKeys } from './useKeystoreState'
import { entropyToMnemonic } from '../crypto/hdwallet-utils'
import { mnemonicFromSeed } from '@algorandfoundation/algokit-utils/algo25'

export type ExecuteWithMnemonicHandler<T> = (words: string[]) => T | Promise<T>

export const useKMS = () => {
    const keystoreKeys = useKeystoreKeys()
    const { createAlgo25Key } = useAlgo25()
    const {
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        getDerivedPublicKey,
    } = useHDWallet()
    const { deleteKey, keyStore, withExportedKey, checkAccess } =
        useKMSService()

    // Wallet-domain view of the keystore: only wallet-root seeds (with
    // `metadata.scheme: 'bip39' | 'algo25'`). Derived signing keys
    // (hd-derived-ed25519, ed25519) and secret-key entries (PIN, biometric)
    // are filtered out by `isSeedKey`.
    const seeds = useMemo(() => {
        const out = new Map<string, Key>()
        for (const k of keystoreKeys) {
            if (isSeedKey(k)) out.set(k.id, k)
        }
        return out
    }, [keystoreKeys])

    // child id → parent (seed) id. Built once per keystore snapshot so
    // helpers like `seedIdOf` are O(1) and don't have to keep scanning the
    // full key list.
    const childToParent = useMemo(() => {
        const m = new Map<string, string>()
        for (const k of keystoreKeys) {
            const parentKeyId = (k.metadata as Record<string, unknown>)
                ?.parentKeyId
            if (typeof parentKeyId === 'string') m.set(k.id, parentKeyId)
        }
        return m
    }, [keystoreKeys])

    /**
     * Resolves a child keystore id to its parent seed id by following
     * `metadata.parentKeyId`. Returns `undefined` for seed entries
     * themselves (no parent), unknown ids, and any other top-level keys.
     *
     * Falls back to a live read of the reactive store when the memoised
     * map doesn't have it yet — necessary for callers that fire during
     * the same async tick a key was committed in (e.g. account removal
     * right after account creation, before React has re-rendered with
     * the new keystore snapshot).
     */
    const seedIdOf = useCallback(
        (childId: string | undefined): string | undefined => {
            if (!childId) return undefined
            const cached = childToParent.get(childId)
            if (cached !== undefined) return cached
            const live = getKeystoreStore().state.keys.find(
                k => k.id === childId,
            )
            const parentKeyId = (
                live?.metadata as Record<string, unknown> | undefined
            )?.parentKeyId
            return typeof parentKeyId === 'string' ? parentKeyId : undefined
        },
        [childToParent],
    )

    /**
     * Removes a top-level key (typically a seed) and every keystore entry
     * whose `metadata.parentKeyId` points back to it. Used by account
     * removal to wipe a seed once no remaining account references it,
     * sweeping orphan derivation entries in the process.
     *
     * Reads `getKeystoreStore().state.keys` directly (not the React
     * snapshot) so callers that fire in the same tick a key was just
     * committed see the up-to-date list.
     */
    const removeKeyAndChildren = useCallback(
        async (rootKeyId: string): Promise<void> => {
            const liveKeys = getKeystoreStore().state.keys
            for (const k of liveKeys) {
                if (k.id === rootKeyId) continue
                const parentKeyId = (k.metadata as Record<string, unknown>)
                    ?.parentKeyId
                if (parentKeyId === rootKeyId) {
                    await keyStore.remove(k.id)
                }
            }
            await keyStore.remove(rootKeyId)
        },
        [keyStore],
    )

    const getKey = useCallback(
        (keyId: string): Key | null => {
            const key = keystoreKeys.find(k => k.id === keyId) ?? null
            if (!key) return null
            // Expiry is stamped on the seed (the wallet-domain root). If
            // the caller is asking about a child, walk up before checking.
            const seedKey = isSeedKey(key)
                ? key
                : (keystoreKeys.find(k => k.id === seedIdOf(keyId)) ?? null)
            if (seedKey) {
                const expiresAt = expiresAtOf(seedKey)
                if (expiresAt && Date.now() > expiresAt.getTime()) {
                    void keyStore.remove(seedKey.id)
                    return null
                }
            }
            return key
        },
        [keystoreKeys, keyStore, seedIdOf],
    )

    const getKeyOrThrow = useCallback(
        (keyId: string): Key => {
            const key = getKey(keyId)
            if (!key) {
                throw new KeyNotFoundError(keyId)
            }
            return key
        },
        [getKey],
    )

    /**
     * Signs each item with the child key at `childKeyId`. The keystore's
     * own `sign` walks `metadata.parentKeyId` to fetch the parent seed and
     * routes correctly (subtle for `ed25519`, XHD for `hd-derived-ed25519`).
     * `domain` is checked against the parent seed's ACL before signing.
     */
    const signTransactionsWithKey = async (
        childKeyId: string,
        domain: string,
        encodedTxs: Uint8Array[],
    ): Promise<Uint8Array[]> => {
        const seedKey = resolveSeedKey(childKeyId)
        checkAccess(seedKey, domain)
        return Promise.all(encodedTxs.map(tx => keyStore.sign(childKeyId, tx)))
    }

    const signDataWithKey = async (
        childKeyId: string,
        domain: string,
        data: Uint8Array[],
    ): Promise<Uint8Array[]> => {
        const seedKey = resolveSeedKey(childKeyId)
        checkAccess(seedKey, domain)
        return Promise.all(data.map(d => keyStore.sign(childKeyId, d)))
    }

    const resolveSeedKey = useCallback(
        (childKeyId: string): Key => {
            const parentId = seedIdOf(childKeyId)
            if (!parentId) {
                // Caller might have passed a seed id directly — accept it
                // as a convenience for callers that haven't migrated yet.
                const direct = getKeyOrThrow(childKeyId)
                if (isSeedKey(direct)) return direct
                throw new InvalidKeyError(childKeyId)
            }
            return getKeyOrThrow(parentId)
        },
        [seedIdOf, getKeyOrThrow],
    )

    /**
     * Runs `handler` with the mnemonic words for the seed that minted
     * `childKeyId`. The seed is resolved via the keystore's
     * `metadata.parentKeyId` chain; the mnemonic itself is reconstructed
     * from the seed's stored bytes (entropy hex for bip39 seeds, raw
     * `privateKey` for algo25). Mnemonic bytes are zeroed before returning.
     */
    const executeWithMnemonic = async <T>(
        childKeyId: string,
        domain: string,
        handler: ExecuteWithMnemonicHandler<T>,
    ): Promise<T> => {
        const seedKey = resolveSeedKey(childKeyId)
        checkAccess(seedKey, domain)
        const scheme = seedSchemeOf(seedKey)
        if (!scheme) throw new InvalidKeyError(seedKey.id)

        return withExportedKey(seedKey.id, async seedData => {
            let words: string[]

            if (scheme === SeedScheme.Bip39) {
                const meta = (seedData.metadata ?? {}) as SeedMetadata
                if (!meta.entropy) {
                    throw new KeyManagementError(
                        'HD seed is missing entropy metadata for mnemonic recovery',
                    )
                }
                const entropyBytes = hexToBytes(meta.entropy)
                try {
                    words = entropyToMnemonic(entropyBytes).split(' ')
                } finally {
                    zeroBytes(entropyBytes)
                }
            } else {
                if (!seedData.privateKey) {
                    throw new KeyManagementError(
                        'Algo25 seed has no private key bytes',
                    )
                }
                words = mnemonicFromSeed(
                    new Uint8Array(seedData.privateKey),
                ).split(' ')
            }

            const bytes = new TextEncoder().encode(words.join(' '))
            try {
                return await handler(words)
            } finally {
                zeroBytes(bytes)
            }
        })
    }

    return {
        /**
         * Seeds keyed by id — wallet-root entries (algo25 + HD). Use
         * `seedIdOf(account.keyPairId)` to navigate from an account's
         * child key to its parent seed.
         */
        keys: seeds,
        seedIdOf,
        removeKeyAndChildren,
        deleteKey,
        getKey,
        getKeyOrThrow,
        createAlgo25Key,
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        getDerivedPublicKey,
        keyStore,
        withExportedKey,
        signTransactionsWithKey,
        signDataWithKey,
        executeWithMnemonic,
    }
}
