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
import { useRoute } from '@react-navigation/native'
import { useDiscoverNewsDetailQuery } from '@perawallet/wallet-core-discover'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverNewsDetailScreen } from '../useDiscoverNewsDetailScreen'

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<object>()),
    useRoute: vi.fn(),
}))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))

const openWebPage = vi.fn()
const refetch = vi.fn(async () => undefined)

const mockDetail = (over: Record<string, unknown> = {}) =>
    vi.mocked(useDiscoverNewsDetailQuery).mockReturnValue({
        data: {
            id: 'n1',
            title: 'Big news',
            banner: null,
            publishedAt: new Date('2026-11-09T10:00:00Z'),
            contentHtml: '<p>Hello <a href="https://x.io">x</a></p>',
        },
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch,
        ...over,
    } as never)

describe('useDiscoverNewsDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useRoute).mockReturnValue({
            params: { newsId: 'n1' },
        } as never)
        vi.mocked(useOpenDapp).mockReturnValue({
            openDapp: vi.fn(),
            openWebPage,
        })
        mockDetail()
    })

    it('reads the id from the route and parses the article', () => {
        const { result } = renderHook(() => useDiscoverNewsDetailScreen())
        expect(useDiscoverNewsDetailQuery).toHaveBeenCalledWith('n1')
        expect(result.current.title).toBe('Big news')
        expect(result.current.dateDisplay).toContain('2026')
        expect(result.current.blocks).toEqual([
            {
                type: 'paragraph',
                children: [
                    expect.objectContaining({ type: 'text', value: 'Hello ' }),
                    expect.objectContaining({
                        type: 'link',
                        href: 'https://x.io',
                    }),
                ],
            },
        ])
    })

    it('openLink opens an https link in the in-app browser', () => {
        const { result } = renderHook(() => useDiscoverNewsDetailScreen())
        act(() => result.current.openLink('https://x.io/a'))
        expect(openWebPage).toHaveBeenCalledWith('https://x.io/a')
    })

    it('openLink ignores links that cannot open', () => {
        const { result } = renderHook(() => useDiscoverNewsDetailScreen())
        act(() => result.current.openLink('javascript:alert(1)'))
        act(() => result.current.openLink('http://x.io'))
        act(() => result.current.openLink('/relative'))
        expect(openWebPage).not.toHaveBeenCalled()
    })

    it('has no blocks before the article arrives', () => {
        mockDetail({ data: undefined, isLoading: true })
        const { result } = renderHook(() => useDiscoverNewsDetailScreen())
        expect(result.current.blocks).toEqual([])
        expect(result.current.isLoading).toBe(true)
    })

    it('shows loading while a retry after an error is in flight', () => {
        mockDetail({ data: undefined, isError: true, isFetching: true })
        const { result } = renderHook(() => useDiscoverNewsDetailScreen())
        expect(result.current.isLoading).toBe(true)
        expect(result.current.isError).toBe(false)
    })
})
