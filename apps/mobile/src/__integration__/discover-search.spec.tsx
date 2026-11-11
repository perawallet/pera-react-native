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

// Native Discover search with Ethereum registered beside Algorand: typing
// searches the dApp directory and both chains' assets, the chips narrow the
// list client-side, a typed domain opens as a favoritable dApp, and recents
// survive a remount.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import {
    assetsAdapterFor,
    useAssetSearchAvailabilityStore,
} from '@perawallet/wallet-core-assets'
import { mockAssetSearch } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { mockDiscoverProjects } from '@perawallet/wallet-core-projects/test-handlers'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useWebViewStore } from '@modules/webview'
import { useDiscoverFavoritesStore } from '@modules/discover/store/useDiscoverFavoritesStore'
import {
    recentSearchKey,
    useDiscoverRecentSearchesStore,
} from '@modules/discover/store/useDiscoverRecentSearchesStore'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const { DiscoverSearchScreen } =
    await import('@modules/discover/screens/DiscoverSearchScreen/DiscoverSearchScreen')

const ALGORAND_MAINNET: ChainScope = {
    chainId: 'algorand' as ChainScope['chainId'],
    networkId: 'mainnet',
}
const ETHEREUM_MAINNET: ChainScope = {
    chainId: 'ethereum' as ChainScope['chainId'],
    networkId: 'mainnet',
}

const DAPP_URL = 'https://app.uniswap.org'
const DAPP_ROW = `discover_search_dapp_${DAPP_URL}`
const ASSET_ROW = 'asset_row_31566704'

const renderSearch = () =>
    renderWithNavigation(DiscoverSearchScreen, 'DiscoverSearch')

const typeQuery = (value: string) => {
    fireEvent.change(screen.getByTestId('discover_search_input'), {
        target: { value },
    })
}

const submit = () => {
    fireEvent.keyDown(screen.getByTestId('discover_search_input'), {
        key: 'Enter',
        code: 'Enter',
    })
}

const pickFilter = (filter: 'all' | 'markets' | 'dapps') => {
    fireEvent.click(screen.getByTestId(`discover_search_filter_${filter}`))
}

const lastWebView = () => useWebViewStore.getState().openWebViews.at(-1)

// Waits out the debounce and both searches, so no timer or query update lands
// after the test body ends.
const settled = async () => {
    await waitFor(
        () => {
            expect(screen.queryByTestId('discover_search_loading')).toBeNull()
        },
        { timeout: 4000 },
    )
    // Lets React Query's batched notifications land inside act.
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })
}

const waitForResults = async () => {
    await waitFor(
        () => {
            expect(screen.getByTestId(ASSET_ROW)).toBeTruthy()
            expect(screen.getByTestId(DAPP_ROW)).toBeTruthy()
        },
        { timeout: 4000 },
    )
}

describe('Flow: Discover search', () => {
    beforeEach(() => {
        useDiscoverFavoritesStore.getState().resetState()
        useDiscoverRecentSearchesStore.getState().resetState()
        useAssetSearchAvailabilityStore.getState().resetState()
        useWebViewStore.getState().clearWebViews()
        server.use(
            mockDiscoverProjects({
                response: [
                    {
                        id: 'p-uni',
                        name: 'Uniswap',
                        url: DAPP_URL,
                        description: 'Swap tokens',
                        short_description: 'Swap tokens',
                        logo_png: 'https://pera.test/uniswap.png',
                        verification_tier: 'verified',
                        popularity_score: 10,
                        chains: [],
                    },
                    {
                        id: 'p-tiny',
                        name: 'Tinyman',
                        url: 'https://tinyman.org',
                        description: 'Algorand swaps',
                        short_description: 'Algorand swaps',
                        logo_png: 'https://pera.test/tinyman.png',
                        verification_tier: 'verified',
                        popularity_score: 5,
                        chains: [],
                    },
                ],
            }),
            mockAssetSearch({
                response: {
                    results: [
                        {
                            asset_id: 31_566_704,
                            name: 'Uni Token',
                            unit_name: 'UNIT',
                            verification_tier: 'verified',
                            usd_value: '1.00',
                            type: 'standard_asset',
                        },
                    ],
                    next: null,
                    previous: null,
                },
            }),
        )
        // Ethereum's token list comes from Pera services a CI build leaves
        // unconfigured, so its search is stubbed at the adapter.
        vi.spyOn(
            assetsAdapterFor(ETHEREUM_MAINNET),
            'search',
        ).mockResolvedValue({
            results: [],
            nextCursor: undefined,
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('Given the user types uni, then All lists the web search, the dApp and the asset, and each chip narrows the list', async () => {
        renderSearch()
        typeQuery('uni')

        await waitForResults()
        expect(screen.getByTestId('discover_search_web_row')).toBeTruthy()
        expect(screen.queryByText('Tinyman')).toBeNull()

        pickFilter('markets')
        expect(screen.getByTestId(ASSET_ROW)).toBeTruthy()
        expect(screen.queryByTestId(DAPP_ROW)).toBeNull()
        expect(screen.queryByTestId('discover_search_web_row')).toBeNull()

        pickFilter('dapps')
        expect(screen.getByTestId(DAPP_ROW)).toBeTruthy()
        expect(screen.queryByTestId(ASSET_ROW)).toBeNull()
    })

    it('Given the dApp result, when it is pressed, then its url opens in the in-app browser and the search is remembered', async () => {
        renderSearch()
        typeQuery('uni')
        await waitForResults()

        fireEvent.click(screen.getByTestId(`${DAPP_ROW}_open`))

        expect(lastWebView()?.url).toBe(DAPP_URL)
        expect(
            useDiscoverRecentSearchesStore.getState().items[0],
        ).toMatchObject({
            kind: 'dapp',
            dapp: { url: DAPP_URL, name: 'Uniswap' },
        })
    })

    it('Given plain text typed, when the user submits, then DuckDuckGo opens', async () => {
        renderSearch()
        typeQuery('uni')
        await settled()
        submit()

        expect(lastWebView()?.url).toBe('https://duckduckgo.com/?q=uni')
        expect(useDiscoverRecentSearchesStore.getState().items[0]).toEqual({
            kind: 'url',
            url: 'https://duckduckgo.com/?q=uni',
        })
    })

    it('Given the user types a domain, when the typed-url row is starred, then a favorite named after the host is stored', async () => {
        renderSearch()
        typeQuery('uniswap.org')
        await settled()

        fireEvent.click(
            await screen.findByTestId('discover_search_typed_url_star'),
        )

        expect(
            useDiscoverFavoritesStore.getState().favorites[
                'https://uniswap.org'
            ]?.name,
        ).toBe('uniswap.org')
    })

    it('Given a starred typed domain, when it is submitted, then it opens with a favorite hook that removes the favorite', async () => {
        renderSearch()
        typeQuery('uniswap.org')
        await settled()
        fireEvent.click(
            await screen.findByTestId('discover_search_typed_url_star'),
        )
        expect(
            useDiscoverFavoritesStore
                .getState()
                .isFavorite('https://uniswap.org'),
        ).toBe(true)

        submit()

        const view = lastWebView()
        expect(view?.url).toBe('https://uniswap.org')
        expect(view?.favorite?.initialIsFavorite).toBe(true)
        act(() => view?.favorite?.onToggle())
        expect(
            useDiscoverFavoritesStore
                .getState()
                .isFavorite('https://uniswap.org'),
        ).toBe(false)
    })

    it('Given a typed domain that is also a directory dApp, then only the typed-url row shows for it', async () => {
        renderSearch()
        typeQuery('app.uniswap.org')
        await settled()

        expect(screen.getByTestId('discover_search_typed_url')).toBeTruthy()
        expect(screen.queryByTestId(DAPP_ROW)).toBeNull()

        pickFilter('dapps')
        expect(screen.getByTestId(DAPP_ROW)).toBeTruthy()
    })

    it('Given a submitted domain in recents, when it is reopened, then it keeps the in-browser star', async () => {
        const first = renderSearch()
        typeQuery('uniswap.org')
        await settled()
        submit()
        first.unmount()
        useWebViewStore.getState().clearWebViews()

        renderSearch()
        fireEvent.click(
            screen.getByTestId(
                `discover_search_recent_${recentSearchKey({ kind: 'url', url: 'https://uniswap.org' })}`,
            ),
        )

        expect(lastWebView()?.url).toBe('https://uniswap.org')
        expect(lastWebView()?.favorite).toBeDefined()
    })

    it('Given recent searches, when the screen remounts, then they are listed, and Clear all empties them', async () => {
        const first = renderSearch()
        typeQuery('uni')
        await settled()
        submit()
        first.unmount()

        renderSearch()
        expect(screen.getByTestId('discover_search_recent_title')).toBeTruthy()
        expect(
            screen.getByTestId(
                `discover_search_recent_${recentSearchKey({ kind: 'url', url: 'https://duckduckgo.com/?q=uni' })}`,
            ),
        ).toBeTruthy()

        fireEvent.click(screen.getByTestId('discover_search_clear_all'))

        expect(screen.getByTestId('discover_search_no_recent')).toBeTruthy()
        expect(useDiscoverRecentSearchesStore.getState().items).toEqual([])
    })

    it("Given Ethereum's asset search fails, then Algorand's asset shows under a partial-results warning on All and Markets", async () => {
        vi.mocked(assetsAdapterFor(ETHEREUM_MAINNET).search!).mockRejectedValue(
            new Error('Ethereum down'),
        )
        renderSearch()
        typeQuery('uni')

        await waitFor(
            () => {
                expect(screen.getByTestId(ASSET_ROW)).toBeTruthy()
            },
            { timeout: 4000 },
        )
        expect(screen.getByText('add_asset.partial_results')).toBeTruthy()

        pickFilter('markets')
        expect(screen.getByTestId(ASSET_ROW)).toBeTruthy()
        expect(screen.getByText('add_asset.partial_results')).toBeTruthy()

        pickFilter('dapps')
        expect(screen.queryByText('add_asset.partial_results')).toBeNull()
        await settled()
    })

    it('Given asset search is unavailable on both chains, then the notice shows on All and Markets while the dApp still lists', async () => {
        const store = useAssetSearchAvailabilityStore.getState()
        store.markSearchUnavailable(ALGORAND_MAINNET, new Error('down'))
        store.markSearchUnavailable(ETHEREUM_MAINNET, new Error('down'))
        renderSearch()
        typeQuery('uni')

        await waitFor(
            () => {
                expect(screen.getByTestId(DAPP_ROW)).toBeTruthy()
            },
            { timeout: 4000 },
        )
        expect(
            screen.getByText('discover.search.assets_unavailable'),
        ).toBeTruthy()
        expect(screen.queryByTestId(ASSET_ROW)).toBeNull()

        pickFilter('markets')
        expect(
            screen.getByText('discover.search.assets_unavailable'),
        ).toBeTruthy()

        pickFilter('dapps')
        expect(
            screen.queryByText('discover.search.assets_unavailable'),
        ).toBeNull()
        expect(screen.getByTestId(DAPP_ROW)).toBeTruthy()
        await settled()
    })
})
