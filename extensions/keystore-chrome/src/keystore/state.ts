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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 store.ts
// Portions Copyright Algorand Foundation, Apache-2.0
//
// Store-management (addKey, removeKey, setStatus, clearKeyStore, getKey,
// initializeKeyStore) plus the four store-level crypto entry points
// (encrypt, decrypt, verify, sign) are vendored here.

import type { Store } from '@tanstack/store'
import { clearKeyData, decryptWithKeyData, encryptWithKeyData } from './crypto'
import { signWithKeyData } from './sign'
import type { Key, KeyData, KeyId, KeyStoreState } from './types'
import { verifyWithKeyData } from './verify'

/**
 * Adds a key to the reactive store.
 *
 * @param store - The TanStack store instance for {@link KeyStoreState}.
 * @param key - The {@link Key} metadata to add.
 */
export function addKey(store: Store<KeyStoreState>, key: Key): void {
    store.setState(s => ({ ...s, keys: [...s.keys, key] }))
}

/**
 * Removes a key from the reactive store by its ID.
 *
 * @param params - The removal parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.keyId - The {@link KeyId} of the key to remove.
 */
export function removeKey({
    store,
    keyId,
}: {
    store: Store<KeyStoreState>
    keyId: KeyId
}): void {
    store.setState(s => ({ ...s, keys: s.keys.filter(k => k.id !== keyId) }))
}

/**
 * Sets the current status of the keystore.
 *
 * @param params - The status parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.status - A string representing the current operation (e.g., "signing", "generating", "idle").
 */
export function setStatus({
    store,
    status,
}: {
    store: Store<KeyStoreState>
    status: string
}): void {
    store.setState(s => ({ ...s, status }))
}

/**
 * Clears all keys from the store and resets status to "idle".
 *
 * @param params - The store parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 */
export function clearKeyStore({
    store,
}: {
    store: Store<KeyStoreState>
}): void {
    store.setState(() => ({ keys: [], status: 'idle' }))
}

/**
 * Retrieves a key from the store by its ID.
 *
 * @param params - The retrieval parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.id - The {@link KeyId} of the key to retrieve.
 * @returns The {@link Key} metadata if found, otherwise undefined.
 */
export function getKey({
    store,
    id,
}: {
    store: Store<KeyStoreState>
    id: KeyId
}): Key | undefined {
    return store.state.keys.find(k => k.id === id)
}

/**
 * Initializes the keystore with a list of keys and sets status to "idle".
 *
 * @param params - The initialization parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.keys - The array of {@link Key} metadata to initialize with.
 */
export function initializeKeyStore({
    store,
    keys,
}: {
    store: Store<KeyStoreState>
    keys: Key[]
}): void {
    store.setState(() => ({ keys, status: 'idle' }))
}

/**
 * Encrypts data using the provided key data.
 *
 * @param params - The encryption parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.key - The {@link KeyData} containing the secret key.
 * @param params.data - The data to encrypt.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to the encrypted data.
 */
export async function encrypt({
    store,
    key,
    data,
    algorithm,
}: {
    store: Store<KeyStoreState>
    key: KeyData
    data: Uint8Array
    algorithm?: string
}): Promise<Uint8Array> {
    setStatus({ store, status: 'encrypting' })
    try {
        return encryptWithKeyData({ key, data, algorithm })
    } finally {
        clearKeyData(key)
        setStatus({ store, status: 'idle' })
    }
}

/**
 * Decrypts data using the provided key data.
 *
 * @param params - The decryption parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.key - The {@link KeyData} containing the secret key.
 * @param params.data - The data to decrypt.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to the decrypted data.
 */
export async function decrypt({
    store,
    key,
    data,
}: {
    store: Store<KeyStoreState>
    key: KeyData
    data: Uint8Array<ArrayBufferLike>
    algorithm?: string
}): Promise<Uint8Array<ArrayBufferLike>> {
    setStatus({ store, status: 'decrypting' })
    try {
        return decryptWithKeyData({ key, data })
    } finally {
        clearKeyData(key)
        setStatus({ store, status: 'idle' })
    }
}

/**
 * Verifies a signature using the provided key data.
 *
 * @param params - The verification parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.key - The {@link KeyData} containing the public key.
 * @param params.data - The data that was signed.
 * @param params.signature - The signature to verify.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to true if the signature is valid, false otherwise.
 */
export async function verify({
    store,
    key,
    data,
    signature,
}: {
    store: Store<KeyStoreState>
    key: KeyData
    data: Uint8Array<ArrayBufferLike>
    signature: Uint8Array<ArrayBufferLike>
    algorithm?: string
}): Promise<boolean> {
    setStatus({ store, status: 'verifying' })
    try {
        return verifyWithKeyData({ key, data, signature })
    } finally {
        clearKeyData(key)
        setStatus({ store, status: 'idle' })
    }
}

/**
 * Signs data using the provided key data and optional parent key for HD derivation.
 *
 * @param params - The signing parameters.
 * @param params.store - The TanStack store instance for {@link KeyStoreState}.
 * @param params.key - The {@link KeyData} containing the private key.
 * @param params.parentKey - Optional parent key data for HD derivation.
 * @param params.data - The data to sign.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to the signature.
 */
export async function sign({
    store,
    key,
    parentKey,
    data,
}: {
    store: Store<KeyStoreState>
    key: KeyData
    parentKey?: KeyData
    data: Uint8Array
    algorithm?: string
}): Promise<Uint8Array> {
    setStatus({ store, status: 'signing' })
    try {
        return signWithKeyData({ key, data, parentKey })
    } finally {
        clearKeyData(key)
        clearKeyData(parentKey)
        setStatus({ store, status: 'idle' })
    }
}
