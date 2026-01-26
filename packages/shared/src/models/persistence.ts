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

import type { PersistOptions } from 'zustand/middleware'

export type PersistListener<S> = (state: S) => void

export type StorePersist<S, Ps, Pr> = S extends {
    getState: () => infer T
    setState: {
        (...args: infer Sa1): infer Sr1
        (...args: infer Sa2): infer Sr2
    }
}
    ? {
          setState(...args: Sa1): Sr1 | Pr
          setState(...args: Sa2): Sr2 | Pr
          persist: {
              setOptions: (options: Partial<PersistOptions<T, Ps, Pr>>) => void
              clearStorage: () => void
              rehydrate: () => Promise<void> | void
              hasHydrated: () => boolean
              onHydrate: (fn: PersistListener<T>) => () => void
              onFinishHydration: (fn: PersistListener<T>) => () => void
              getOptions: () => Partial<PersistOptions<T, Ps, Pr>>
          }
      }
    : never

export type Write<T, U> = Omit<T, keyof U> & U

export type WithPersist<S, A> = Write<S, StorePersist<S, A, unknown>>

export type BaseStoreState = {
    resetState: () => void
}
