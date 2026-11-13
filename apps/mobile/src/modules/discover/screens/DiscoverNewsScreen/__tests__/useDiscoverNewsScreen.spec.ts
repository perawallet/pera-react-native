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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiscoverNewsQuery } from '@perawallet/wallet-core-discover'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useDiscoverNewsScreen } from '../useDiscoverNewsScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))

const navigate = vi.fn()
const refetch = vi.fn(async () => undefined)

const mockNews = (over: Record<string, unknown> = {}) =>
    vi.mocked(useDiscoverNewsQuery).mockReturnValue({
        data: [
            {
                id: 'n1',
                title: 'Big news',
                banner: 'https://pera.test/1.png',
                publishedAt: new Date('2026-11-09T10:00:00Z'),
            },
        ],
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch,
        ...over,
    } as never)

describe('useDiscoverNewsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never)
        mockNews()
    })

    it('maps the news to cards with a formatted date', () => {
        const { result } = renderHook(() => useDiscoverNewsScreen())
        expect(result.current.items).toEqual([
            {
                id: 'n1',
                title: 'Big news',
                banner: 'https://pera.test/1.png',
                dateDisplay: expect.stringContaining('2026'),
            },
        ])
    })

    it('openNewsItem tracks the tap and opens the detail', () => {
        const { result } = renderHook(() => useDiscoverNewsScreen())
        act(() => result.current.openNewsItem(result.current.items[0]!))
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.NewsOpenTap, {
            news_title: 'Big news',
        })
        expect(navigate).toHaveBeenCalledWith('DiscoverNewsDetail', {
            newsId: 'n1',
        })
    })

    it('shows loading while a retry after an error is in flight', () => {
        mockNews({ data: undefined, isError: true, isFetching: true })
        const { result } = renderHook(() => useDiscoverNewsScreen())
        expect(result.current.isLoading).toBe(true)
        expect(result.current.isError).toBe(false)
    })

    it('retry refetches', () => {
        const { result } = renderHook(() => useDiscoverNewsScreen())
        act(() => result.current.retry())
        expect(refetch).toHaveBeenCalled()
    })
})
