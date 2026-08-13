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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Banner } from '@perawallet/wallet-core-banners'

const mocks = vi.hoisted(() => ({
    banners: [] as Banner[],
    forcedBanner: null as Banner | null,
    autoOpenedBannerIds: [] as string[],
}))

vi.mock('@perawallet/wallet-core-banners', () => ({
    useVisibleBanners: () => ({
        banners: mocks.banners,
        totalCount: mocks.banners.length,
        forcedBanner: mocks.forcedBanner,
        isLoading: false,
        isError: false,
    }),
    useBannersStore: (
        selector: (state: { autoOpenedBannerIds: string[] }) => unknown,
    ) => selector({ autoOpenedBannerIds: mocks.autoOpenedBannerIds }),
}))

import { useBannerPrompt } from '../useBannerPrompt'

const buildBanner = (id: number, autoOpenMode?: 'force' | 'select') =>
    ({ id: String(id), autoOpenMode }) as Banner

describe('useBannerPrompt', () => {
    beforeEach(() => {
        mocks.banners = []
        mocks.forcedBanner = null
        mocks.autoOpenedBannerIds = []
    })

    it('is not due when no banner asks to open itself', () => {
        mocks.banners = [buildBanner(1), buildBanner(2)]

        const { result } = renderHook(() => useBannerPrompt())

        expect(result.current.isDue).toBe(false)
        expect(result.current.isForced).toBe(false)
    })

    it('is due and forced for a force banner', () => {
        const forced = buildBanner(99, 'force')
        // useVisibleBanners narrows the visible set to the forced banner.
        mocks.banners = [forced]
        mocks.forcedBanner = forced

        const { result } = renderHook(() => useBannerPrompt())

        expect(result.current.isDue).toBe(true)
        // Drives both the queue rank and the sheet hold: a forced banner may
        // carry a forced update notice, so it outranks every nudge.
        expect(result.current.isForced).toBe(true)
    })

    it('is due but not forced for a select banner', () => {
        mocks.banners = [buildBanner(1), buildBanner(42, 'select')]

        const { result } = renderHook(() => useBannerPrompt())

        expect(result.current.isDue).toBe(true)
        expect(result.current.isForced).toBe(false)
    })

    it('is no longer due once the banner has had its turn this session', () => {
        mocks.banners = [buildBanner(42, 'select')]
        mocks.autoOpenedBannerIds = ['42']

        const { result } = renderHook(() => useBannerPrompt())

        expect(result.current.isDue).toBe(false)
    })

    it('re-evaluates when a banner is marked mid-session', () => {
        // Reading autoOpenedBannerIds as an array rather than through the
        // store's hasAutoOpened getter is what makes this update — the getter
        // closes over the state it was built with.
        mocks.banners = [buildBanner(42, 'select')]
        const { result, rerender } = renderHook(() => useBannerPrompt())
        expect(result.current.isDue).toBe(true)

        mocks.autoOpenedBannerIds = ['42']
        rerender()

        expect(result.current.isDue).toBe(false)
    })
})
