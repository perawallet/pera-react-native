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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.hoisted(() => vi.fn())
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
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: registerStoreMock,
        createPersistStorage: createMockPersistStorage,
    }
})

describe('useCollectiblePreferencesStore', () => {
    beforeEach(async () => {
        const { useCollectiblePreferencesStore } =
            await import('../collectible-preferences-store')
        useCollectiblePreferencesStore.getState().resetState()
    })

    test('setters update each preference field', async () => {
        const { useCollectiblePreferencesStore } =
            await import('../collectible-preferences-store')
        const { result } = renderHook(() => useCollectiblePreferencesStore())

        act(() => {
            result.current.setCollectibleSortMode('recentlyAdded')
            result.current.setGalleryLayout('list')
            result.current.setShowOptedIn(true)
            result.current.setShowWatchAccounts(true)
        })

        expect(result.current.collectibleSortMode).toBe('recentlyAdded')
        expect(result.current.galleryLayout).toBe('list')
        expect(result.current.showOptedIn).toBe(true)
        expect(result.current.showWatchAccounts).toBe(true)
    })

    test('resetState restores the titleAsc/grid defaults with showOptedIn on', async () => {
        const { useCollectiblePreferencesStore } =
            await import('../collectible-preferences-store')
        const { result } = renderHook(() => useCollectiblePreferencesStore())

        act(() => {
            result.current.setCollectibleSortMode('titleDesc')
            result.current.setGalleryLayout('list')
            result.current.setShowOptedIn(false)
            result.current.setShowWatchAccounts(true)
        })
        act(() => {
            result.current.resetState()
        })

        expect(result.current).toMatchObject({
            collectibleSortMode: 'titleAsc',
            galleryLayout: 'grid',
            showOptedIn: true,
            showWatchAccounts: false,
        })
    })

    test('registers resetState and clearStorage with the store registry', async () => {
        const { useCollectiblePreferencesStore } =
            await import('../collectible-preferences-store')

        const registrations = registerStoreMock.mock.calls.filter(
            ([r]) => r?.name === 'collectible-preferences-store',
        )
        expect(registrations).not.toHaveLength(0)
        const registration = registrations.at(-1)?.[0]

        act(() => {
            useCollectiblePreferencesStore.getState().setShowOptedIn(false)
        })
        act(() => registration.resetState())
        expect(useCollectiblePreferencesStore.getState().showOptedIn).toBe(true)

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
