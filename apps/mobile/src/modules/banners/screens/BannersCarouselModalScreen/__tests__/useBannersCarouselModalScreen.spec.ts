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
import type { Banner } from '@perawallet/wallet-core-banners'

const mockGoBack = vi.fn()
const mockCanGoBack = vi.fn().mockReturnValue(true)
const mockSetOptions = vi.fn()
const mockUseVisibleBanners = vi.fn()
const mockDismissBanner = vi.fn()
const mockRoute = vi.fn()
const mockUseRoute = vi.fn().mockReturnValue({ params: undefined })

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        canGoBack: mockCanGoBack,
        setOptions: mockSetOptions,
    }),
    useRoute: () => mockUseRoute(),
}))

vi.mock('@perawallet/wallet-core-banners', () => ({
    useVisibleBanners: () => mockUseVisibleBanners(),
    useBannersStore: (selector: (s: unknown) => unknown) =>
        selector({ dismissBanner: mockDismissBanner }),
}))

vi.mock('../../../hooks', () => ({
    useBannerLinkRouter: () => ({ route: mockRoute }),
}))

import { useBannersCarouselModalScreen } from '../useBannersCarouselModalScreen'

const buildBanner = (id: number): Banner => ({
    id: String(id),
    type: 'generic',
    title: `B${id}`,
    subtitle: null,
    buttonLabel: 'Go',
    buttonUrl: 'pera://x',
    isButtonUrlExternal: false,
    autoOpenMode: null,
    backgroundImageUrl: null,
})

const buildForced = (id: number): Banner => ({
    ...buildBanner(id),
    autoOpenMode: 'force',
})

beforeEach(() => {
    mockGoBack.mockReset()
    mockCanGoBack.mockReturnValue(true)
    mockSetOptions.mockReset()
    mockUseVisibleBanners.mockReset()
    mockDismissBanner.mockReset()
    mockRoute.mockReset()
    mockUseRoute.mockReturnValue({ params: undefined })
})

describe('useBannersCarouselModalScreen', () => {
    it('exposes the visible banners', () => {
        const banners = [buildBanner(1), buildBanner(2)]
        mockUseVisibleBanners.mockReturnValue({
            banners,
            totalCount: 2,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useBannersCarouselModalScreen())
        expect(result.current.banners).toEqual(banners)
        expect(result.current.isDismissable).toBe(true)
        expect(result.current.isClosable).toBe(true)
        expect(result.current.initialIndex).toBe(0)
    })

    it('initialIndex focuses the banner matching the route bannerId param', () => {
        mockUseRoute.mockReturnValue({ params: { bannerId: '2' } })
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1), buildBanner(2), buildBanner(3)],
            totalCount: 3,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useBannersCarouselModalScreen())
        expect(result.current.initialIndex).toBe(1)
    })

    it('initialIndex falls back to 0 when bannerId is not found', () => {
        mockUseRoute.mockReturnValue({ params: { bannerId: '999' } })
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1)],
            totalCount: 1,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useBannersCarouselModalScreen())
        expect(result.current.initialIndex).toBe(0)
    })

    it('routes via banner link router with isButtonUrlExternal flag', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1)],
            totalCount: 1,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useBannersCarouselModalScreen())
        act(() => result.current.onPressCTA(buildBanner(1)))

        expect(mockRoute).toHaveBeenCalledWith({
            url: 'pera://x',
            isExternal: false,
        })
    })

    it('dispatches dismissBanner on dismiss when dismissable', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(5)],
            totalCount: 1,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useBannersCarouselModalScreen())
        act(() => result.current.onDismiss(buildBanner(5)))

        expect(mockDismissBanner).toHaveBeenCalledWith('5')
    })

    it('auto-closes when there are no banners', () => {
        mockUseVisibleBanners.mockReturnValue({
            banners: [],
            totalCount: 0,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        renderHook(() => useBannersCarouselModalScreen())
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('does not goBack from onClose if navigation cannot go back', () => {
        mockCanGoBack.mockReturnValue(false)
        mockUseVisibleBanners.mockReturnValue({
            banners: [buildBanner(1)],
            totalCount: 1,
            forcedBanner: null,
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useBannersCarouselModalScreen())
        act(() => result.current.onClose())

        expect(mockGoBack).not.toHaveBeenCalled()
    })

    describe('forced banner', () => {
        const forced = buildForced(7)

        beforeEach(() => {
            mockUseVisibleBanners.mockReturnValue({
                banners: [forced],
                totalCount: 1,
                forcedBanner: forced,
                isLoading: false,
                isError: false,
            })
        })

        it('reports isDismissable=false and isClosable=false', () => {
            const { result } = renderHook(() => useBannersCarouselModalScreen())
            expect(result.current.isDismissable).toBe(false)
            expect(result.current.isClosable).toBe(false)
        })

        it('ignores onClose calls', () => {
            const { result } = renderHook(() => useBannersCarouselModalScreen())
            act(() => result.current.onClose())
            expect(mockGoBack).not.toHaveBeenCalled()
        })

        it('ignores onDismiss calls', () => {
            const { result } = renderHook(() => useBannersCarouselModalScreen())
            act(() => result.current.onDismiss(forced))
            expect(mockDismissBanner).not.toHaveBeenCalled()
        })
    })
})
