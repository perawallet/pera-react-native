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
// Only the store-management half of upstream's store.ts is vendored here
// (addKey, removeKey, setStatus, clearKeyStore, getKey, initializeKeyStore).
// The crypto entry points (encrypt/decrypt/verify/sign) depend on sign.ts and
// verify.ts, which are not yet vendored — a later task adds them.

import type { Store } from '@tanstack/store'
import type { Key, KeyId, KeyStoreState } from './types'

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
