/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Banner } from '@perawallet/wallet-core-banners'
import { useBannerPrompt } from '../useBannerPrompt'

const mocks = vi.hoisted(() => ({
    dismissBanner: vi.fn(),
    markAutoOpened: vi.fn(),
    routeUrl: vi.fn(),
    banners: [] as Banner[],
    forcedBanner: null as Banner | null,
}))

vi.mock('@perawallet/wallet-core-banners', () => ({
    useVisibleBanners: () => ({
        banners: mocks.banners,
        forcedBanner: mocks.forcedBanner,
    }),
    useBannersStore: (selector: (state: unknown) => unknown) =>
        selector({
            dismissBanner: mocks.dismissBanner,
            markAutoOpened: mocks.markAutoOpened,
        }),
}))

vi.mock('@modules/banners', () => ({
    useBannerLinkRouter: () => ({ route: mocks.routeUrl }),
}))

const banner = { id: 'banner-1', buttonUrl: 'https://pera.example' } as Banner

describe('useBannerPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.banners = [banner]
        mocks.forcedBanner = null
    })

    it('closes the prompt and marks the banner as opened', () => {
        const onHide = vi.fn()
        const { result } = renderHook(() => useBannerPrompt({ onHide }))

        act(() => result.current.finish())

        expect(mocks.markAutoOpened).toHaveBeenCalledWith('banner-1')
        expect(onHide).toHaveBeenCalledWith('banner_prompt')
    })

    it('dismisses the banner and closes the prompt', () => {
        const onHide = vi.fn()
        const { result } = renderHook(() => useBannerPrompt({ onHide }))

        act(() => result.current.handleDismiss(banner))

        expect(mocks.dismissBanner).toHaveBeenCalledWith('banner-1')
        expect(onHide).toHaveBeenCalledWith('banner_prompt')
    })

    it('keeps a forced banner up when the user tries to dismiss it', () => {
        mocks.forcedBanner = banner
        const onHide = vi.fn()
        const { result } = renderHook(() => useBannerPrompt({ onHide }))

        act(() => result.current.handleDismiss(banner))

        expect(mocks.dismissBanner).not.toHaveBeenCalled()
        expect(onHide).not.toHaveBeenCalled()
    })
})
