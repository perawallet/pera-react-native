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
import type { SpotBanner } from '@perawallet/wallet-core-banners'

const mockDismiss = vi.fn()
const mockUseSpotBannersQuery = vi.fn()
const mockRoute = vi.fn()

vi.mock('@perawallet/wallet-core-banners', () => ({
    useSpotBannersQuery: () => mockUseSpotBannersQuery(),
    useDismissSpotBannerMutation: () => ({ mutate: mockDismiss }),
}))

vi.mock('../../../hooks', () => ({
    useBannerLinkRouter: () => ({ route: mockRoute }),
}))

import { useMessagesSpotBanners } from '../useMessagesSpotBanners'

const banner: SpotBanner = {
    id: '17',
    text: 'Try',
    imageUrl: 'https://cdn.test/x.png',
    url: 'pera://x',
    isUrlExternal: false,
}

beforeEach(() => {
    mockDismiss.mockReset()
    mockRoute.mockReset()
    mockUseSpotBannersQuery.mockReset()
})

describe('useMessagesSpotBanners', () => {
    it('is hidden when there are no spot banners', () => {
        mockUseSpotBannersQuery.mockReturnValue({
            spotBanners: [],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useMessagesSpotBanners())
        expect(result.current.isVisible).toBe(false)
    })

    it('exposes banners when present', () => {
        mockUseSpotBannersQuery.mockReturnValue({
            spotBanners: [banner],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useMessagesSpotBanners())
        expect(result.current.isVisible).toBe(true)
        expect(result.current.spotBanners).toEqual([banner])
    })

    it('routes via banner link router on press', () => {
        mockUseSpotBannersQuery.mockReturnValue({
            spotBanners: [banner],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useMessagesSpotBanners())
        act(() => result.current.onPress(banner))

        expect(mockRoute).toHaveBeenCalledWith({
            url: 'pera://x',
            isExternal: false,
        })
    })

    it('dispatches dismiss mutation with banner id', () => {
        mockUseSpotBannersQuery.mockReturnValue({
            spotBanners: [banner],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useMessagesSpotBanners())
        act(() => result.current.onDismiss(banner))

        expect(mockDismiss).toHaveBeenCalledWith('17')
    })
})
