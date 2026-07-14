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
// Ported from @algorandfoundation/react-native-keystore@1.0.0-canary.12
// storage/state.ts — react-native-mmkv replaced by the chrome-storage adapter;
// Buffer replaced by Uint8Array throughout.

import {
    clearKeyData,
    InvalidKeyDataError,
    type KeyData,
    type KeyId,
    type KeyStoreState,
    setStatus,
} from '@algorandfoundation/keystore'
import { clearBuffer } from '@algorandfoundation/wallet-provider'
import { base64url } from '@scure/base'
import type { Store } from '@tanstack/store'
import { decryptData, encryptData, getMasterKey } from './crypto'
import type { AuthenticationOptions } from '../types'
import { storage } from './chrome-storage'

/**
 * Fetches a secret from persistent storage and decrypts it using the master key.
 * @param params - The fetch parameters.
 * @param params.keyId - The ID of the key to fetch
 * @param params.options - Options to override the biometrics and masterkey
 * @returns The decrypted secret data or null if not found
 */
export async function fetchSecret<T>({
    keyId,
    options,
}: {
    keyId: KeyId
    options?: AuthenticationOptions & { masterKey?: Uint8Array }
}): Promise<T | null> {
    let key = options?.masterKey
    let isInternalKey = false
    try {
        const encryptedData = storage.getString(keyId)
        if (!encryptedData) return null
        if (!key) {
            key = await getMasterKey(options)
            isInternalKey = true
        }
        return decode(decryptData(key, encryptedData)) as T
    } finally {
        if (isInternalKey && key) {
            clearBuffer(key)
        }
    }
}

/**
 * Removes a secret from persistent storage.
 * @param params - The removal parameters.
 * @param params.keyId - The ID of the key to remove
 */
export async function removeSecret({ keyId }: { keyId: KeyId }): Promise<void> {
    storage.remove(keyId)
}

/**
 * Commits a key to persistent storage and updates the reactive store.
 * The private key is encrypted before storage and cleared from memory.
 * @param params - The commit parameters.
 * @param params.store - The reactive store instance
 * @param params.keyData - The key data to store
 */
export async function commit({
    store,
    keyData,
    options,
}: {
    store: Store<KeyStoreState>
    keyData: KeyData
    options?: AuthenticationOptions
}): Promise<void> {
    if (typeof keyData.id === 'undefined')
        throw new InvalidKeyDataError(
            'KeyData must have an ID before committing to storage. Please use generateKey() to generate a new key.',
        )
    setStatus({ store, status: 'commiting' })

    // Divergence from RN source: masterKey is captured so it can be zeroed in
    // the finally block. Fresh copy per call on web, safe to zero. Declared
    // here (not assigned via a pre-try await) so a locked vault's
    // VaultLockedError from getMasterKey still hits the finally below —
    // otherwise the store would stay stuck at status 'commiting' forever.
    let masterKey: Uint8Array | undefined
    try {
        masterKey = await getMasterKey(options)
        // Never allow the master key to touch memory longer than needed.
        // Divergence from RN source: storage.set is awaited — chrome.storage is
        // async where MMKV was synchronous; a failed write must fail the commit.
        await storage.set(keyData.id, encryptData(masterKey, encode(keyData)))
        // remove the private keys from keyData
        // oxlint-disable-next-line
        const { privateKey, seed, ...keyState } = keyData as any
        // clear then delete the keys from the keyData object to remove it from memory, even from the caller 😈
        clearBuffer(privateKey)
        clearBuffer(seed)
        // oxlint-disable-next-line
        delete (keyData as any).privateKey
        // oxlint-disable-next-line
        delete (keyData as any).seed

        // Reflect the change in the reactive store
        store.setState(state => ({
            ...state,
            keys: [{ ...keyState }, ...state.keys],
        }))
    } finally {
        if (masterKey) clearBuffer(masterKey)
        clearKeyData(keyData)
        setStatus({ store, status: 'idle' })
    }
}

export function encode(key: KeyData): string {
    const encoder = new TextEncoder()
    return base64url.encode(
        encoder.encode(
            JSON.stringify(key, (_key, value) => {
                if (
                    value instanceof Uint8Array ||
                    (value?.constructor &&
                        value.constructor.name === 'Uint8Array')
                ) {
                    return Array.from(value)
                }
                return value
            }),
        ),
    )
}

export function decode(data: string): KeyData {
    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(base64url.decode(data)), (key, value) => {
        if (
            (key.endsWith('Key') ||
                key === 'privateKey' ||
                key === 'publicKey' ||
                key === 'seed' ||
                key === 'key') &&
            Array.isArray(value)
        ) {
            return new Uint8Array(value)
        }
        return value
    })
}
