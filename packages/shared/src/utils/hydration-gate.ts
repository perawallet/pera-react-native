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

import type { PersistOptions, PersistStorage } from 'zustand/middleware'

/**
 * zustand's persist writes on every `set`, hydrated or not. For a store that
 * skips hydration, a `set` before it runs, or after one whose read or
 * migration threw, would replace the persisted state with the in-memory
 * defaults. These options drop writes from the start of each hydration until
 * it has merged what storage held, which is also where persist writes a
 * migrated state back.
 */
export const gateWritesOnHydration = <S, P>(
    storage: PersistStorage<P> | undefined,
): Pick<PersistOptions<S, P>, 'storage' | 'merge'> => {
    let isWritable = false
    return {
        storage: storage && {
            getItem: name => {
                isWritable = false
                return storage.getItem(name)
            },
            setItem: (name, value) =>
                isWritable ? storage.setItem(name, value) : undefined,
            removeItem: name => storage.removeItem(name),
        },
        merge: (persisted, current) => {
            const merged = { ...current, ...(persisted as Partial<S>) }
            isWritable = true
            return merged
        },
    }
}
