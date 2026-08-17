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

import type { KeychainStorage } from '@algorandfoundation/react-native-keystore'

export type FakeKeychainStorage = KeychainStorage & {
    /**
     * A plain object, never the backing `Map`: `assertIdempotent` rejects a
     * snapshot containing a `Map` or `Set`, because both normalise to `{}` and
     * would compare equal however badly the migration mangled them.
     */
    entries(): Record<string, string>
}

/** A `Map`-backed {@link KeychainStorage} for revisions that run off device. */
export const fakeStorage = (
    initial: Record<string, string> = {},
): FakeKeychainStorage => {
    const store = new Map<string, string>(Object.entries(initial))

    return {
        getString: key => store.get(key),
        set: (key, value) => {
            store.set(key, value)
        },
        remove: key => {
            store.delete(key)
        },
        getAllKeys: () => Array.from(store.keys()),
        entries: () => Object.fromEntries(store),
    }
}
