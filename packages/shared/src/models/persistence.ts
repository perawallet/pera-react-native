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
