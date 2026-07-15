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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type {
    Banner,
    BannerAutoOpenMode,
} from '@perawallet/wallet-core-banners'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockUseVisibleBanners = vi.fn()
const mockMarkAutoOpened = vi.fn()
const mockHasAutoOpened = vi.fn()

vi.mock('@perawallet/wallet-core-banners', () => ({
    useVisibleBanners: () => mockUseVisibleBanners(),
    useBannersStore: (selector: (s: unknown) => unknown) =>
        selector({
            markAutoOpened: mockMarkAutoOpened,
            hasAutoOpened: mockHasAutoOpened,
        }),
}))

import { useHomeBannersStrip } from '../useHomeBannersStrip'

const buildBanner = (
    id: number,
    autoOpenMode: BannerAutoOpenMode | null = null,
): Banner => ({
    id: String(id),
    type: 'generic',
    title: `Banner ${id}`,
    subtitle: null,
    buttonLabel: null,
    buttonUrl: null,
    isButtonUrlExternal: false,
    autoOpenMode,
    backgroundImageUrl: null,
})

beforeEach(() => {
    mockNavigate.mockReset()
    mockUseVisibleBanners.mockReset()
    mockMarkAutoOpened.mockReset()
    mockHasAutoOpened.mockReset().mockReturnValue(false)
})

describe('useHomeBannersStrip', () => {
    it('is hidden when no banners are visible', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [],
            totalCount: 0,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useHomeBannersStrip())
        expect(result.current.isVisible).toBe(false)
        expect(result.current.current).toBeNull()
        expect(result.current.banners).toEqual([])
        expect(result.current.additionalCount).toBe(0)
    })

    it('exposes the first banner and the remaining count', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1), buildBanner(2), buildBanner(3)],
            totalCount: 3,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useHomeBannersStrip())

        expect(result.current.isVisible).toBe(true)
        expect(result.current.current?.id).toBe('1')
        expect(result.current.banners).toHaveLength(3)
        expect(result.current.additionalCount).toBe(2)
    })

    it('navigates with no params on manual press', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1)],
            totalCount: 1,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useHomeBannersStrip())
        act(() => result.current.onPress())

        expect(mockNavigate).toHaveBeenCalledWith('BannersCarouselModal')
    })

    it('auto-opens the carousel for a select banner and marks it', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1), buildBanner(42, 'select')],
            totalCount: 2,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        renderHook(() => useHomeBannersStrip())

        expect(mockMarkAutoOpened).toHaveBeenCalledWith('42')
        expect(mockNavigate).toHaveBeenCalledWith('BannersCarouselModal', {
            bannerId: '42',
        })
    })

    it('prefers force over select for auto-open', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1, 'select'), buildBanner(99, 'force')],
            totalCount: 2,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        renderHook(() => useHomeBannersStrip())

        expect(mockMarkAutoOpened).toHaveBeenCalledWith('99')
        expect(mockNavigate).toHaveBeenCalledWith('BannersCarouselModal', {
            bannerId: '99',
        })
    })

    it('does not auto-open if the candidate banner has already been auto-opened this session', () => {
        mockHasAutoOpened.mockReturnValue(true)
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(42, 'select')],
            totalCount: 1,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        renderHook(() => useHomeBannersStrip())

        expect(mockMarkAutoOpened).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('does not auto-open when no banner has an auto-open mode', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1), buildBanner(2)],
            totalCount: 2,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        renderHook(() => useHomeBannersStrip())

        expect(mockMarkAutoOpened).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
