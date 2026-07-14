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
import { act, renderHook } from '@testing-library/react'
import { useVisibleBanners } from '../useVisibleBanners'

vi.mock('../useBannersQuery', () => ({
    useBannersQuery: vi.fn().mockReturnValue({
        banners: [
            {
                id: 1,
                type: 'governance',
                title: 'A',
                subtitle: null,
                buttonLabel: null,
                buttonUrl: null,
                isButtonUrlExternal: false,
                autoOpenMode: null,
                backgroundImageUrl: null,
            },
            {
                id: 2,
                type: 'generic',
                title: 'B',
                subtitle: null,
                buttonLabel: null,
                buttonUrl: null,
                isButtonUrlExternal: false,
                autoOpenMode: null,
                backgroundImageUrl: null,
            },
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    }),
}))

beforeEach(async () => {
    const { useBannersStore } = await import('../../store')
    act(() => useBannersStore.getState().resetState())
})

describe('useVisibleBanners', () => {
    it('returns all banners when none are dismissed and none are forced', () => {
        const { result } = renderHook(() => useVisibleBanners())
        expect(result.current.banners.map(b => b.id)).toEqual([1, 2])
        expect(result.current.forcedBanner).toBeNull()
    })

    it('filters out dismissed banner IDs', async () => {
        const { useBannersStore } = await import('../../store')
        const { result } = renderHook(() => useVisibleBanners())

        act(() => useBannersStore.getState().dismissBanner(1))

        expect(result.current.banners.map(b => b.id)).toEqual([2])
        expect(result.current.totalCount).toBe(1)
    })

    it('returns only the forced banner when one is present, ignoring dismissals', async () => {
        const { useBannersStore } = await import('../../store')
        const { useBannersQuery } = await import('../useBannersQuery')
        vi.mocked(useBannersQuery).mockReturnValue({
            banners: [
                {
                    id: 10,
                    type: 'generic',
                    title: 'normal',
                    subtitle: null,
                    buttonLabel: null,
                    buttonUrl: null,
                    isButtonUrlExternal: false,
                    autoOpenMode: null,
                    backgroundImageUrl: null,
                },
                {
                    id: 20,
                    type: 'generic',
                    title: 'forced',
                    subtitle: null,
                    buttonLabel: null,
                    buttonUrl: null,
                    isButtonUrlExternal: false,
                    autoOpenMode: 'force',
                    backgroundImageUrl: null,
                },
            ],
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        // Dismiss the forced banner — should still be returned.
        act(() => useBannersStore.getState().dismissBanner(20))

        const { result } = renderHook(() => useVisibleBanners())
        expect(result.current.banners.map(b => b.id)).toEqual([20])
        expect(result.current.forcedBanner?.id).toBe(20)
    })
})
