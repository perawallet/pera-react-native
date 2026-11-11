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

import type { resolveSeedKeyFrom } from '@perawallet/wallet-core-kms'

type Key = Parameters<typeof resolveSeedKeyFrom>[0][number]

/** A seed key as `seedOf` and `resolveSeedKeyFrom` recognise one. */
export const fakeSeedKey = (id: string): Key =>
    ({ id, type: 'seed', metadata: { scheme: 'bip39' } }) as unknown as Key

/** A signing key minted from `parentKeyId`, or a seedless raw key when omitted. */
export const fakeChildKey = (id: string, parentKeyId?: string): Key =>
    ({
        id,
        type: 'ed25519',
        metadata: parentKeyId ? { parentKeyId } : {},
    }) as unknown as Key

/** The slice of the provider's keystore store that `useKeystoreKeys` and `seedOf` read. */
export const createFakeKeystore = () => {
    const listeners = new Set<() => void>()
    const store = {
        state: { keys: [] as Key[] },
        subscribe: (listener: () => void) => {
            listeners.add(listener)
            return { unsubscribe: () => listeners.delete(listener) }
        },
    }
    return {
        store,
        /** Replaces the key list, as the real store does on every change, and notifies subscribers. */
        setKeys: (keys: Key[]) => {
            store.state.keys = keys
            listeners.forEach(listener => listener())
        },
    }
}
