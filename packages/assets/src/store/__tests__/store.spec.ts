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

import { describe, it, expect, beforeEach, vi } from 'vitest'

// In-memory keyValueStorage so the persist middleware can be exercised
// without pulling the real provider (which transitively imports
// react-native-mmkv and is not available in the jsdom test environment).
const memoryStore = new Map<string, string>()
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => memoryStore.get(key) ?? null,
            setItem: (key: string, value: string) => {
                memoryStore.set(key, value)
            },
            removeItem: (key: string) => {
                memoryStore.delete(key)
            },
        },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
    }
})

import { useAssetPreferencesStore } from '../store'

describe('useAssetPreferencesStore', () => {
    beforeEach(() => {
        useAssetPreferencesStore.getState().resetState()
    })

    it('initializes with the expected default values', () => {
        const state = useAssetPreferencesStore.getState()
        expect(state.assetSortMode).toBe('balanceDesc')
        expect(state.hideZeroBalance).toBe(false)
        expect(state.displayNfts).toBe(false)
        expect(state.displayOptedInNfts).toBe(false)
    })

    it('setHideZeroBalance updates the value', () => {
        useAssetPreferencesStore.getState().setHideZeroBalance(true)
        expect(useAssetPreferencesStore.getState().hideZeroBalance).toBe(true)

        useAssetPreferencesStore.getState().setHideZeroBalance(false)
        expect(useAssetPreferencesStore.getState().hideZeroBalance).toBe(false)
    })

    it('setDisplayNfts updates the value independently of other fields', () => {
        useAssetPreferencesStore.getState().setDisplayNfts(true)
        const state = useAssetPreferencesStore.getState()
        expect(state.displayNfts).toBe(true)
        expect(state.displayOptedInNfts).toBe(false)
        expect(state.hideZeroBalance).toBe(false)
    })

    it('setDisplayOptedInNfts updates the value independently of other fields', () => {
        useAssetPreferencesStore.getState().setDisplayOptedInNfts(true)
        const state = useAssetPreferencesStore.getState()
        expect(state.displayOptedInNfts).toBe(true)
        expect(state.displayNfts).toBe(false)
    })

    it('setAssetSortMode updates the sort mode', () => {
        useAssetPreferencesStore.getState().setAssetSortMode('alphabeticalAsc')
        expect(useAssetPreferencesStore.getState().assetSortMode).toBe(
            'alphabeticalAsc',
        )
    })

    it('resetState restores all defaults', () => {
        const store = useAssetPreferencesStore.getState()
        store.setHideZeroBalance(true)
        store.setDisplayNfts(true)
        store.setDisplayOptedInNfts(true)
        store.setAssetSortMode('balanceAsc')

        useAssetPreferencesStore.getState().resetState()

        const state = useAssetPreferencesStore.getState()
        expect(state.assetSortMode).toBe('balanceDesc')
        expect(state.hideZeroBalance).toBe(false)
        expect(state.displayNfts).toBe(false)
        expect(state.displayOptedInNfts).toBe(false)
    })
})
