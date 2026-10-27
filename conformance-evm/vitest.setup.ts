import { vi } from 'vitest'

// The real provider pulls in react-native-mmkv, which cannot load under Node;
// the chain table's import graph reaches it. Platform storage only.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
}))
