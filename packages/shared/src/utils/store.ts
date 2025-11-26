import { UseBoundStore, StoreApi, ExtractState } from 'zustand'

export interface LazyStore<T extends StoreApi<unknown>> {
    useStore: UseBoundStore<T>
    init: (realStore: UseBoundStore<T>) => void
    _internal: { store: UseBoundStore<T> | null }
}

export function createLazyStore<T extends StoreApi<unknown>>(): LazyStore<T> {
    let store: UseBoundStore<T> | null = null

    const useStore: UseBoundStore<T> = ((selector: (state: ExtractState<T>) => unknown) => {
        if (!store) {
            throw new Error('Zustand store used before initialization')
        }
        return store(selector)
    }) as UseBoundStore<T>

    return {
        useStore,
        init(realStore) {
            store = realStore
        },
        _internal: { store },
    }
}