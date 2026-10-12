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

import type {
    GuardedPersistOptions,
    QuarantinableStorage,
} from './guarded-persist-core'

/**
 * zustand's persist writes on every `set`, hydrated or not. For a store that
 * skips hydration, a `set` before it runs, or after one whose read threw,
 * would replace the persisted state with the in-memory defaults. These
 * options drop writes to the store's own key from the start of each hydration
 * until it has merged what storage held, which is also where persist writes a
 * migrated state back. Other keys, such as the quarantine copy, pass through.
 */
export const gateWritesOnHydration = <S, U = S>(
    name: string,
    getStorage: () => QuarantinableStorage,
): Pick<GuardedPersistOptions<S, U>, 'storage' | 'merge'> => {
    let isWritable = false
    return {
        storage: () => {
            const storage = getStorage()
            return {
                getItem: key => {
                    if (key === name) isWritable = false
                    return storage.getItem(key)
                },
                setItem: (key, value) => {
                    if (key === name && !isWritable) return
                    storage.setItem(key, value)
                },
                removeItem: key => storage.removeItem(key),
            }
        },
        merge: (persisted, current) => {
            const merged = { ...current, ...(persisted as Partial<S>) }
            isWritable = true
            return merged
        },
    }
}
