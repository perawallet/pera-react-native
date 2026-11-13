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
import {
    useAssetSearchAcrossScopesQuery,
    type ScopedAssetSearchResult,
} from '@perawallet/wallet-core-assets'
import type { PeraProject } from '@perawallet/wallet-core-projects'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapableChainIds } from '@hooks/useCapableChainIds'
import { useDiscoverDirectory } from '../../../hooks/useDiscoverDirectory'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverRecentSearchesStore } from '../../../store/useDiscoverRecentSearchesStore'
import { dappFromUrl } from '../../../utils/toDiscoverDapp'
import { useDiscoverSearchScreen } from '../useDiscoverSearchScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))
vi.mock('@hooks/useCapableChainIds', () => ({ useCapableChainIds: vi.fn() }))
vi.mock('../../../hooks/useDiscoverDirectory', () => ({
    useDiscoverDirectory: vi.fn(),
}))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))

const navigate = vi.fn()
const goBack = vi.fn()
const openDapp = vi.fn()
const openWebPage = vi.fn()

const uniswap: PeraProject = {
    chains: [],
    name: 'Uniswap',
    url: 'https://app.uniswap.org',
    popularityScore: 3,
}

const usdc: ScopedAssetSearchResult = {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    asset: {
        assetId: '31566704',
        name: 'USD Coin',
        unitName: 'USDC',
        peraMetadata: { logo: 'https://pera.test/usdc.png' },
    },
}

const assetQuery = (
    over: Partial<ReturnType<typeof useAssetSearchAcrossScopesQuery>> = {},
) =>
    vi.mocked(useAssetSearchAcrossScopesQuery).mockReturnValue({
        results: [usdc],
        isLoading: false,
        isError: false,
        error: null,
        isUnavailable: false,
        unavailableReasons: [],
        isPaused: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        isIncomplete: false,
        ...over,
    })

const mockDirectory = (verified: string[] = []) =>
    vi.mocked(useDiscoverDirectory).mockReturnValue({
        projects: [uniswap],
        verifiedUrls: new Set(verified),
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
    })

const setup = () => renderHook(() => useDiscoverSearchScreen())

const typeQuery = (
    result: { current: ReturnType<typeof useDiscoverSearchScreen> },
    q: string,
) => {
    act(() => {
        result.current.setQuery(q)
    })
}

const expectNoQueryInAnalytics = () => {
    for (const [, payload] of vi.mocked(trackEvent).mock.calls) {
        const serialised = JSON.stringify(payload)
        expect(serialised).not.toContain('q=')
        expect(serialised).not.toContain('?')
        expect(serialised).not.toContain('#')
    }
}

const recents = () => useDiscoverRecentSearchesStore.getState().items

describe('useDiscoverSearchScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
        useDiscoverRecentSearchesStore.setState({ items: [] })
        vi.mocked(useAppNavigation).mockReturnValue({
            navigate,
            goBack,
        } as never)
        vi.mocked(useCapableChainIds).mockReturnValue(['algorand'])
        vi.mocked(useOpenDapp).mockReturnValue({ openDapp, openWebPage })
        mockDirectory()
        assetQuery()
    })

    describe('typedUrl', () => {
        it.each([
            'uni',
            'uniswap',
            'hello world',
            'javascript:alert(1)',
            'http://evil',
            'http://evil.com',
        ])('is null for %j', q => {
            const { result } = setup()
            typeQuery(result, q)
            expect(result.current.typedUrl).toBeNull()
        })

        it('is the https url for a domain', () => {
            const { result } = setup()
            typeQuery(result, 'uniswap.org')
            expect(result.current.typedUrl).toBe('https://uniswap.org')
        })
    })

    describe('submit', () => {
        it('opens DuckDuckGo for plain text and records that url as the recent', () => {
            const { result } = setup()
            typeQuery(result, 'uni')
            act(() => result.current.submit())
            expect(openWebPage).toHaveBeenCalledWith(
                'https://duckduckgo.com/?q=uni',
            )
            expect(recents()[0]).toEqual({
                kind: 'url',
                url: 'https://duckduckgo.com/?q=uni',
            })
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.SearchResultTap,
                {
                    dapp_url: 'https://duckduckgo.com/',
                },
            )
            expectNoQueryInAnalytics()
        })

        it('opens DuckDuckGo with the encoded text for javascript:alert(1)', () => {
            const { result } = setup()
            typeQuery(result, 'javascript:alert(1)')
            act(() => result.current.submit())
            expect(openWebPage).toHaveBeenCalledWith(
                `https://duckduckgo.com/?q=${encodeURIComponent('javascript:alert(1)')}`,
            )
            expect(openDapp).not.toHaveBeenCalled()
            expect(recents()[0]).toEqual({
                kind: 'url',
                url: `https://duckduckgo.com/?q=${encodeURIComponent('javascript:alert(1)')}`,
            })
        })

        it('keeps the typed text out of analytics for a web search', () => {
            const { result } = setup()
            typeQuery(result, 'secret words')
            act(() => result.current.submit())
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.SearchResultTap,
                {
                    dapp_url: 'https://duckduckgo.com/',
                },
            )
            expectNoQueryInAnalytics()
        })

        it('strips the query and hash from a typed url sent to analytics', () => {
            const { result } = setup()
            typeQuery(result, 'uniswap.org/swap?token=secret#frag')
            act(() => result.current.submit())
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.SearchResultTap,
                {
                    dapp_name: 'uniswap.org',
                    dapp_url: 'https://uniswap.org/swap',
                },
            )
            expectNoQueryInAnalytics()
        })

        it('opens http://evil.com on DuckDuckGo, never as a typed url', () => {
            const { result } = setup()
            typeQuery(result, 'http://evil.com')
            act(() => result.current.submit())
            expect(openDapp).not.toHaveBeenCalled()
            expect(openWebPage).toHaveBeenCalledWith(
                `https://duckduckgo.com/?q=${encodeURIComponent('http://evil.com')}`,
            )
        })

        it('opens a typed domain as a dapp with the favorite hook', () => {
            const { result } = setup()
            typeQuery(result, 'uniswap.org')
            act(() => result.current.submit())
            expect(openDapp).toHaveBeenCalledWith(
                dappFromUrl('https://uniswap.org'),
                null,
            )
            expect(recents()[0]).toEqual({
                kind: 'url',
                url: 'https://uniswap.org',
            })
        })

        it('does nothing for a blank query', () => {
            const { result } = setup()
            typeQuery(result, '   ')
            act(() => result.current.submit())
            expect(openDapp).not.toHaveBeenCalled()
            expect(openWebPage).not.toHaveBeenCalled()
            expect(recents()).toEqual([])
        })
    })

    describe('asset search arguments', () => {
        it('does not change the asset query when the chip changes', () => {
            const { result } = setup()
            typeQuery(result, 'uni')
            const callsFor = () =>
                vi.mocked(useAssetSearchAcrossScopesQuery).mock.calls.at(-1)
            const before = callsFor()
            expect(before?.[0]).toBe('uni')
            expect(before?.[2]).toEqual({ enabled: true })
            act(() => result.current.setFilter('markets'))
            expect(callsFor()?.[0]).toBe('uni')
            expect(callsFor()?.[1]).toEqual(before?.[1])
            expect(callsFor()?.[2]).toEqual({ enabled: true })
            act(() => result.current.setFilter('dapps'))
            expect(callsFor()?.[2]).toEqual({ enabled: true })
        })

        it('is disabled for a blank query', () => {
            setup()
            expect(
                vi
                    .mocked(useAssetSearchAcrossScopesQuery)
                    .mock.calls.at(-1)?.[2],
            ).toEqual({ enabled: false })
        })
    })

    describe('filtering', () => {
        it('lists dapps and assets under All', () => {
            const { result } = setup()
            typeQuery(result, 'uni')
            expect(result.current.dappResults.map(d => d.name)).toEqual([
                'Uniswap',
            ])
            expect(result.current.assetResults).toEqual([usdc])
            expect(result.current.isWebSearchRowVisible).toBe(true)
        })

        it('has no dapps on Markets and no assets on dApps', () => {
            const { result } = setup()
            typeQuery(result, 'uni')
            act(() => result.current.setFilter('markets'))
            expect(result.current.dappResults).toEqual([])
            expect(result.current.assetResults).toEqual([usdc])
            expect(result.current.isWebSearchRowVisible).toBe(false)
            act(() => result.current.setFilter('dapps'))
            expect(result.current.dappResults).toHaveLength(1)
            expect(result.current.assetResults).toEqual([])
        })

        it('drops the dapp row for the typed domain on All, keeping it on dApps', () => {
            const { result } = setup()
            typeQuery(result, 'app.uniswap.org')
            expect(result.current.typedUrl).toBe('https://app.uniswap.org')
            expect(result.current.dappResults).toEqual([])
            act(() => result.current.setFilter('dapps'))
            expect(result.current.dappResults).toHaveLength(1)
        })

        it('offers three chips', () => {
            const { result } = setup()
            expect(result.current.filterOptions.map(o => o.value)).toEqual([
                'all',
                'markets',
                'dapps',
            ])
        })
    })

    describe('asset search state', () => {
        it('reports an incomplete search', () => {
            assetQuery({ isIncomplete: true })
            const { result } = setup()
            expect(result.current.isAssetSearchIncomplete).toBe(true)
            expect(result.current.isAssetSearchUnavailable).toBe(false)
        })

        it('reports an unavailable search', () => {
            assetQuery({ results: [], isUnavailable: true })
            const { result } = setup()
            expect(result.current.isAssetSearchIncomplete).toBe(false)
            expect(result.current.isAssetSearchUnavailable).toBe(true)
        })

        it('reports loading', () => {
            assetQuery({ results: [], isLoading: true })
            const { result } = setup()
            expect(result.current.isLoadingAssets).toBe(true)
        })
    })

    describe('verification and chains', () => {
        it('joins verification by normalised url', () => {
            mockDirectory(['https://app.uniswap.org'])
            const { result } = setup()
            expect(result.current.isVerified('https://App.Uniswap.org/')).toBe(
                true,
            )
            expect(result.current.isVerified('https://uniswap.org')).toBe(false)
        })

        it('shows chains only with more than one discover chain', () => {
            expect(setup().result.current.showChains).toBe(false)
            vi.mocked(useCapableChainIds).mockReturnValue([
                'algorand',
                'ethereum',
            ])
            expect(setup().result.current.showChains).toBe(true)
        })
    })

    describe('opening results', () => {
        it('opens a dapp, records it and tracks the tap', () => {
            const { result } = setup()
            typeQuery(result, 'uni')
            const dapp = result.current.dappResults[0]!
            act(() => result.current.openDapp(dapp))
            expect(openDapp).toHaveBeenCalledWith(dapp, null)
            expect(recents()[0]).toEqual({ kind: 'dapp', dapp })
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.SearchResultTap,
                {
                    dapp_name: 'Uniswap',
                    dapp_url: 'https://app.uniswap.org',
                },
            )
        })

        it('opens an asset on its details and records an asset recent', () => {
            const { result } = setup()
            act(() => result.current.openAsset(usdc))
            expect(navigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: {
                    screen: 'AssetDetails',
                    params: { assetId: '31566704', chainId: 'algorand' },
                },
            })
            expect(recents()[0]).toEqual({
                kind: 'asset',
                ref: { chainId: 'algorand', assetId: '31566704' },
                networkId: 'mainnet',
                name: 'USD Coin',
                unitName: 'USDC',
                logo: 'https://pera.test/usdc.png',
            })
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.SearchResultTap,
                {
                    asset_id: '31566704',
                    chain_id: 'algorand',
                },
            )
        })

        it('reopens a searched domain as a dapp, keeping the star, and a DuckDuckGo search as a plain page', () => {
            const { result } = setup()
            act(() =>
                result.current.openRecent({
                    kind: 'url',
                    url: 'https://uniswap.org',
                }),
            )
            expect(openDapp).toHaveBeenCalledWith(
                dappFromUrl('https://uniswap.org'),
                null,
            )
            expect(openWebPage).not.toHaveBeenCalled()
            act(() =>
                result.current.openRecent({
                    kind: 'url',
                    url: 'https://duckduckgo.com/?q=uniswap.org',
                }),
            )
            expect(openWebPage).toHaveBeenCalledWith(
                'https://duckduckgo.com/?q=uniswap.org',
            )
            expect(openDapp).toHaveBeenCalledTimes(1)
            expect(trackEvent).toHaveBeenLastCalledWith(
                DiscoverEvent.SearchResultTap,
                { dapp_url: 'https://duckduckgo.com/' },
            )
            expectNoQueryInAnalytics()
        })

        it('strips the query from a reopened typed-url recent in analytics', () => {
            const { result } = setup()
            act(() =>
                result.current.openRecent({
                    kind: 'url',
                    url: 'https://uniswap.org/swap?token=secret',
                }),
            )
            expect(trackEvent).toHaveBeenCalledWith(
                DiscoverEvent.SearchResultTap,
                {
                    dapp_name: 'uniswap.org',
                    dapp_url: 'https://uniswap.org/swap',
                },
            )
            expectNoQueryInAnalytics()
        })

        it('reopens each kind of recent', () => {
            const { result } = setup()
            act(() =>
                result.current.openRecent({
                    kind: 'url',
                    url: 'https://duckduckgo.com/?q=a',
                }),
            )
            expect(openWebPage).toHaveBeenCalledWith(
                'https://duckduckgo.com/?q=a',
            )
            const dapp = dappFromUrl('https://a.io')!
            act(() => result.current.openRecent({ kind: 'dapp', dapp }))
            expect(openDapp).toHaveBeenCalledWith(dapp, null)
            act(() =>
                result.current.openRecent({
                    kind: 'asset',
                    ref: { chainId: 'algorand', assetId: '1' },
                    networkId: 'mainnet',
                    name: 'X',
                    unitName: 'X',
                    logo: null,
                }),
            )
            expect(navigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: {
                    screen: 'AssetDetails',
                    params: { assetId: '1', chainId: 'algorand' },
                },
            })
            expect(trackEvent).toHaveBeenCalledTimes(3)
        })
    })

    describe('asset recents per network', () => {
        const assetRecent = (networkId: 'mainnet' | 'testnet') =>
            ({
                kind: 'asset',
                ref: { chainId: 'algorand', assetId: '1' },
                networkId,
                name: 'X',
                unitName: 'X',
                logo: null,
            }) as const

        it('shows an asset recent from the selected network only', () => {
            useDiscoverRecentSearchesStore.setState({
                items: [assetRecent('testnet'), assetRecent('mainnet')],
            })
            const { result } = setup()
            expect(result.current.recents).toEqual([assetRecent('mainnet')])
        })

        it('hides an asset recent whose chain no longer has asset search', () => {
            useDiscoverRecentSearchesStore.setState({
                items: [assetRecent('mainnet')],
            })
            vi.mocked(useCapableChainIds).mockReturnValue([])
            const { result } = setup()
            expect(result.current.recents).toEqual([])
        })
    })

    describe('directory error', () => {
        it('reports dapp search unavailable when the directory failed with no cache', () => {
            vi.mocked(useDiscoverDirectory).mockReturnValue({
                projects: [],
                verifiedUrls: new Set(),
                isLoading: false,
                isError: true,
                isFetching: false,
                refetch: vi.fn(),
            })
            expect(setup().result.current.isDappSearchUnavailable).toBe(true)
        })

        it('keeps searching a cached list when a refetch failed', () => {
            vi.mocked(useDiscoverDirectory).mockReturnValue({
                projects: [uniswap],
                verifiedUrls: new Set(),
                isLoading: false,
                isError: true,
                isFetching: false,
                refetch: vi.fn(),
            })
            expect(setup().result.current.isDappSearchUnavailable).toBe(false)
        })
    })

    describe('favorites and recents', () => {
        it('stores the typed url favorite under its host name', () => {
            const { result } = setup()
            typeQuery(result, 'uniswap.org')
            act(() => result.current.toggleTypedUrlFavorite())
            const favorite =
                useDiscoverFavoritesStore.getState().favorites[
                    'https://uniswap.org'
                ]
            expect(favorite?.name).toBe('uniswap.org')
            expect(result.current.isFavorite('https://uniswap.org')).toBe(true)
        })

        it('toggles a dapp favorite', () => {
            const { result } = setup()
            typeQuery(result, 'uni')
            const dapp = result.current.dappResults[0]!
            act(() => result.current.toggleFavorite(dapp))
            expect(result.current.isFavorite(dapp.url)).toBe(true)
            act(() => result.current.toggleFavorite(dapp))
            expect(result.current.isFavorite(dapp.url)).toBe(false)
        })

        it('removes one recent and clears all', () => {
            const { result } = setup()
            act(() => result.current.openAsset(usdc))
            act(() =>
                result.current.openRecent({ kind: 'url', url: 'https://a.io' }),
            )
            expect(result.current.recents).toHaveLength(2)
            act(() => result.current.removeRecent('url:https://a.io'))
            expect(result.current.recents).toHaveLength(1)
            act(() => result.current.clearRecents())
            expect(result.current.recents).toEqual([])
        })

        it('cancel goes back', () => {
            const { result } = setup()
            act(() => result.current.cancel())
            expect(goBack).toHaveBeenCalled()
        })
    })
})
