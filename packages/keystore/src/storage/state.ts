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
import { MMKV } from 'react-native-mmkv'
import { decryptData, encryptData, getMasterKey } from './crypto.ts'

export const storage: MMKV = new MMKV({
    id: 'keystore',
})

/**
 * Rehydrates all keys from storage into the reactive store.
 * Private keys are decrypted, removed, and then the metadata is stored.
 * @param store - The reactive store instance
 */
export async function rehydrate({
    store,
}: {
    store: Store<KeyStoreState>
}): Promise<void> {
    setStatus({ store, status: 'commiting' })
    const masterKey = await getMasterKey()

    try {
        const keys: KeyData[] = []
        for (const keyId of storage.getAllKeys()) {
            const encryptedData = storage.getString(keyId)
            if (encryptedData) {
                try {
                    const keyData = decode(
                        decryptData(masterKey, encryptedData),
                    ) as KeyData
                    // remove the private keys from keyData before adding to state
                    const { privateKey, publicKey, ...keyState } = keyData
                    keys.push({ ...keyState } as KeyData)
                } catch (e) {
                    console.error(`Failed to decrypt key ${keyId}`, e)
                }
            }
        }

        store.setState(state => ({
            ...state,
            keys,
        }))
    } finally {
        clearBuffer(masterKey)
        setStatus({ store, status: 'idle' })
    }
}

/**
 * Fetches a secret from persistent storage and decrypts it using the master key.
 * @param params - The fetch parameters.
 * @param params.keyId - The ID of the key to fetch
 * @param params.masterKey - Optional master key override
 * @returns The decrypted secret data or null if not found
 */
export async function fetchSecret<T>({
    keyId,
    masterKey,
}: {
    keyId: KeyId
    masterKey?: Buffer
}): Promise<T | null> {
    try {
        const encryptedSeed = storage.getString(keyId)
        if (!encryptedSeed) return null
        return decode(
            decryptData(
                masterKey ? masterKey : await getMasterKey(),
                encryptedSeed,
            ),
        ) as T
    } finally {
        clearBuffer(masterKey)
    }
}

/**
 * Removes a secret from persistent storage.
 * @param params - The removal parameters.
 * @param params.keyId - The ID of the key to remove
 */
export async function removeSecret({ keyId }: { keyId: KeyId }): Promise<void> {
    storage.delete(keyId)
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
}: {
    store: Store<KeyStoreState>
    keyData: KeyData
}): Promise<void> {
    if (typeof keyData.id === 'undefined')
        throw new InvalidKeyDataError(
            'KeyData must have an ID before committing to storage. Please use generateKey() to generate a new key.',
        )
    setStatus({ store, status: 'commiting' })

    try {
        // Never allow the master key to touch memory.
        storage.set(
            keyData.id,
            encryptData(await getMasterKey(), encode(keyData)),
        )
        // remove the private keys from keyData
        const { privateKey, publicKey, ...keyState } = keyData
        // clear then delete the keys from the keyData object to remove it from memory, even from the caller 😈
        clearBuffer(privateKey)
        clearBuffer(publicKey)
        delete keyData.privateKey
        delete keyData.publicKey

        // Reflect the change in the reactive store
        store.setState(state => ({
            ...state,
            keys: [{ ...keyState }, ...state.keys],
        }))
    } finally {
        clearKeyData(keyData)
        setStatus({ store, status: 'idle' })
    }
}

export function encode(key: KeyData): string {
    const encoder = new TextEncoder()
    return base64url.encode(
        encoder.encode(
            JSON.stringify(key, (_key, value) => {
                if (value instanceof Uint8Array) {
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
        if (key.endsWith('Key') && Array.isArray(value)) {
            return new Uint8Array(value)
        }
        return value
    })
}
