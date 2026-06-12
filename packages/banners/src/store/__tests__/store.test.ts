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

import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.fn()

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

describe('banners/store', () => {
    beforeEach(async () => {
        const { useBannersStore } = await import('../index')
        act(() => useBannersStore.getState().resetState())
    })

    test('initial state has no dismissed banners', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        expect(result.current.dismissedBannerIds).toEqual([])
    })

    test('dismissBanner appends ID once', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        act(() => {
            result.current.dismissBanner('1')
        })

        expect(result.current.dismissedBannerIds).toEqual(['1'])
    })

    test('dismissBanner is idempotent', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        act(() => {
            result.current.dismissBanner('7')
            result.current.dismissBanner('7')
            result.current.dismissBanner('7')
        })

        expect(result.current.dismissedBannerIds).toEqual(['7'])
    })

    test('isBannerDismissed reflects dismissal state', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        act(() => {
            result.current.dismissBanner('42')
        })

        expect(result.current.isBannerDismissed('42')).toBe(true)
        expect(result.current.isBannerDismissed('99')).toBe(false)
    })

    test('resetState clears dismissed IDs', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        act(() => {
            result.current.dismissBanner('1')
            result.current.dismissBanner('2')
            result.current.resetState()
        })

        expect(result.current.dismissedBannerIds).toEqual([])
    })

    test('markAutoOpened tracks IDs idempotently', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        act(() => {
            result.current.markAutoOpened('50')
            result.current.markAutoOpened('50')
            result.current.markAutoOpened('51')
        })

        expect(result.current.autoOpenedBannerIds).toEqual(['50', '51'])
        expect(result.current.hasAutoOpened('50')).toBe(true)
        expect(result.current.hasAutoOpened('99')).toBe(false)
    })

    test('resetState clears autoOpenedBannerIds', async () => {
        const { useBannersStore } = await import('../index')
        const { result } = renderHook(() => useBannersStore())

        act(() => {
            result.current.markAutoOpened('7')
            result.current.resetState()
        })
        expect(result.current.autoOpenedBannerIds).toEqual([])
    })

    test('registers reset/clearStorage with the store registry', async () => {
        await import('../index')
        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('banners-store')

        const { useBannersStore } = await import('../index')
        act(() => {
            useBannersStore.getState().dismissBanner('3')
        })

        act(() => registration.resetState())
        expect(useBannersStore.getState().dismissedBannerIds).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
