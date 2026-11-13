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
import { useDiscoverChainIds } from '../../../hooks/useDiscoverChainIds'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useTopDapps, type UseTopDappsResult } from '../../../hooks/useTopDapps'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../../types'
import { useDiscoverHomeScreen } from '../useDiscoverHomeScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
// The unit registry has no chain descriptors; names come from here.
vi.mock('@perawallet/wallet-core-chain-shared', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-chain-shared')),
    chainDisplayNameOf: (id: string) =>
        id === 'ethereum' ? 'Ethereum' : undefined,
}))
vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))
vi.mock('../../../hooks/useDiscoverChainIds', () => ({
    useDiscoverChainIds: vi.fn(),
}))
vi.mock('../../../hooks/useTopDapps', () => ({ useTopDapps: vi.fn() }))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))

const navigate = vi.fn()
const openDapp = vi.fn()
const topDappsRefetch = vi.fn(async () => undefined)
const newsRefetch = vi.fn(async () => undefined)

const uniswap: DiscoverDapp = {
    url: 'https://app.uniswap.org',
    name: 'Uniswap',
    logo: null,
    categories: ['DEX'],
    chains: ['ethereum'],
}

const mockTopDapps = (over: Partial<UseTopDappsResult> = {}) =>
    vi.mocked(useTopDapps).mockReturnValue({
        dapps: [uniswap],
        verifiedUrls: new Set(['https://app.uniswap.org']),
        isLoading: false,
        isError: false,
        refetch: topDappsRefetch,
        ...over,
    })

const mockNews = (data?: ReturnType<typeof useDiscoverNewsQuery>['data']) =>
    vi.mocked(useDiscoverNewsQuery).mockReturnValue({
        data,
        isLoading: false,
        isError: false,
        refetch: newsRefetch,
    } as never)

const setup = () => renderHook(() => useDiscoverHomeScreen())

describe('useDiscoverHomeScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
        vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never)
        vi.mocked(useDiscoverChainIds).mockReturnValue(['algorand', 'ethereum'])
        vi.mocked(useOpenDapp).mockReturnValue({
            openDapp,
            openWebPage: vi.fn(),
        })
        mockTopDapps()
        mockNews([])
    })

    describe('chains', () => {
        it('selects the first discover chain by default and feeds it to the top dApps', () => {
            const { result } = setup()
            expect(result.current.selectedChainId).toBe('algorand')
            expect(useTopDapps).toHaveBeenLastCalledWith('algorand')
        })

        it('offers one chip per chain and no All chip', () => {
            const { result } = setup()
            expect(result.current.chainOptions.map(o => o.value)).toEqual([
                'algorand',
                'ethereum',
            ])
            expect(result.current.chainOptions[0]?.testID).toBe(
                'discover_chain_filter_algorand',
            )
        })

        it('has no chips with a single discover chain', () => {
            vi.mocked(useDiscoverChainIds).mockReturnValue(['algorand'])
            const { result } = setup()
            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
        })

        it('has no selected chain when no chain supports discover', () => {
            vi.mocked(useDiscoverChainIds).mockReturnValue([])
            const { result } = setup()
            expect(result.current.selectedChainId).toBeNull()
            expect(useTopDapps).toHaveBeenLastCalledWith(null)
        })

        it('selectChain switches the chain and tracks the filter tap', () => {
            const { result } = setup()
            act(() => result.current.selectChain('ethereum'))
            expect(result.current.selectedChainId).toBe('ethereum')
            expect(result.current.selectedChainName).toBe('Ethereum')
            expect(useTopDapps).toHaveBeenLastCalledWith('ethereum')
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.DappFilterTap,
                { filter_name: 'Ethereum', chain_id: 'ethereum' },
            )
        })

        it('falls back to the first chain when the picked chain stops supporting discover', () => {
            const { result, rerender } = setup()
            act(() => result.current.selectChain('ethereum'))
            vi.mocked(useDiscoverChainIds).mockReturnValue(['algorand'])
            rerender()
            expect(result.current.selectedChainId).toBe('algorand')
        })

        it('leaves the chain key out of the tap for a null selection', () => {
            const { result } = setup()
            act(() => result.current.selectChain(null))
            const payload = vi.mocked(trackEvent).mock.calls[0]?.[1]
            expect(payload).not.toHaveProperty('chain_id')
        })
    })

    describe('news', () => {
        it('maps items to cards with a formatted date', () => {
            mockNews([
                {
                    id: 'n1',
                    title: 'Big news',
                    banner: null,
                    publishedAt: new Date('2026-11-09T10:00:00Z'),
                },
            ])
            const { result } = setup()
            expect(result.current.news.items).toEqual([
                {
                    id: 'n1',
                    title: 'Big news',
                    banner: null,
                    dateDisplay: expect.stringContaining('2026'),
                },
            ])
        })

        it('has no items before the news arrive', () => {
            mockNews(undefined)
            const { result } = setup()
            expect(result.current.news.items).toEqual([])
        })
    })

    describe('navigation', () => {
        it('openSearch tracks the tap and opens the search screen', () => {
            const { result } = setup()
            act(() => result.current.openSearch())
            expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.SearchBarTap)
            expect(navigate).toHaveBeenCalledWith('DiscoverSearch')
        })

        it('openDappDirectory tracks the tap and opens the directory on the selected chain', () => {
            const { result } = setup()
            act(() => result.current.openDappDirectory())
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.TopDappsButtonTap,
            )
            expect(navigate).toHaveBeenCalledWith('DiscoverDapps', {
                chainId: 'algorand',
            })
        })

        it('openDapp opens the dApp with the selected chain', () => {
            const { result } = setup()
            act(() => result.current.openDapp(uniswap))
            expect(openDapp).toHaveBeenCalledWith(uniswap, 'algorand')
        })
    })

    describe('verification', () => {
        it.each([
            'https://app.uniswap.org',
            'HTTPS://APP.UNISWAP.ORG',
            'https://app.uniswap.org/',
        ])('isVerified is true for %s', url => {
            const { result } = setup()
            expect(result.current.isVerified(url)).toBe(true)
        })

        it('isVerified is false for an unlisted url', () => {
            const { result } = setup()
            expect(result.current.isVerified('https://evil.example')).toBe(
                false,
            )
        })
    })

    describe('favorites', () => {
        it('toggleFavorite adds then removes the dApp and tracks each', () => {
            const { result } = setup()
            expect(result.current.isFavorite(uniswap.url)).toBe(false)

            act(() => result.current.toggleFavorite(uniswap))
            expect(result.current.isFavorite(uniswap.url)).toBe(true)
            expect(trackEvent).toHaveBeenLastCalledWith(
                DiscoverEvent.DappFavoriteTap,
                {
                    dapp_name: 'Uniswap',
                    dapp_url: uniswap.url,
                    chain_id: 'algorand',
                },
            )

            act(() => result.current.toggleFavorite(uniswap))
            expect(result.current.isFavorite(uniswap.url)).toBe(false)
            expect(trackEvent).toHaveBeenLastCalledWith(
                DiscoverEvent.DappUnfavoriteTap,
                {
                    dapp_name: 'Uniswap',
                    dapp_url: uniswap.url,
                    chain_id: 'algorand',
                },
            )
        })
    })

    describe('refresh', () => {
        it('refetches the top dApps and the news, toggling isRefreshing', async () => {
            const { result } = setup()
            expect(result.current.isRefreshing).toBe(false)

            let pending!: Promise<void>
            act(() => {
                pending = result.current.refresh()
            })
            expect(result.current.isRefreshing).toBe(true)

            await act(async () => {
                await pending
            })
            expect(topDappsRefetch).toHaveBeenCalledTimes(1)
            expect(newsRefetch).toHaveBeenCalledTimes(1)
            expect(result.current.isRefreshing).toBe(false)
        })

        it('clears isRefreshing and rethrows when a refetch fails', async () => {
            topDappsRefetch.mockRejectedValueOnce(new Error('boom'))
            const { result } = setup()

            await act(async () => {
                await expect(result.current.refresh()).rejects.toThrow('boom')
            })
            expect(result.current.isRefreshing).toBe(false)
        })
    })
})
