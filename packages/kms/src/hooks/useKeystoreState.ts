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

import { useSyncExternalStore } from 'react'
import type { Key } from '@algorandfoundation/keystore-core'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { Optional } from '@perawallet/wallet-core-shared'

const subscribe = (listener: () => void): (() => void) => {
    const sub = getKeystoreStore().subscribe(listener)
    return () => sub.unsubscribe()
}

const getKeysSnapshot = (): Key[] => getKeystoreStore().state.keys

/**
 * React hook returning the current `Key[]` from the keystore's reactive store.
 * Components re-render whenever a key is imported, generated, or removed.
 */
export const useKeystoreKeys = (): Key[] =>
    useSyncExternalStore(subscribe, getKeysSnapshot, getKeysSnapshot)

/**
 * React hook returning a single keystore Key by id, or undefined if not
 * present. Re-renders when that key (or any other) is added or removed.
 */
export const useKeystoreKey = (id: Optional<string>): Optional<Key> => {
    const keys = useKeystoreKeys()
    return id ? keys.find(k => k.id === id) : undefined
}
