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

// Native Discover Favorites screen: search narrows the list together with the
// shared category filter, the header opens Rearrange, and Rearrange removes a
// favorite only on Apply.

import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { mockDiscoverProjects } from '@perawallet/wallet-core-projects/test-handlers'
import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { headeredScreen } from '@routes/screen-options'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { useDiscoverFavoritesStore } from '@modules/discover/store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '@modules/discover/store/useDiscoverFavoritesFilterStore'
import type { DiscoverDapp } from '@modules/discover/types'

const { DiscoverAllFavoritesScreen } =
    await import('@modules/discover/screens/DiscoverAllFavoritesScreen')

const dapp = (name: string, category: string): DiscoverDapp => ({
    url: `https://${name.toLowerCase()}.example`,
    name,
    logo: null,
    categories: [category],
    chains: [],
})

const store = () => useDiscoverFavoritesStore.getState()

// Lets React Query's batched notifications land inside act.
const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })

const Stack = createNativeStackNavigator()

/** The Favorites screen under the app's real header, with the sheet host. */
const renderFavorites = () =>
    render(
        <>
            <BottomSheetManager />
            <Stack.Navigator>
                <Stack.Screen
                    name='DiscoverAllFavorites'
                    component={DiscoverAllFavoritesScreen}
                    options={headeredScreen('discover.favorites.title')}
                />
            </Stack.Navigator>
        </>,
    )

const rows = () =>
    screen
        .queryAllByTestId(
            /^discover_all_favorites_dapp_https:\/\/[a-z]+\.example$/,
        )
        .map(row => row.getAttribute('data-testid'))

describe('Flow: Discover Favorites screen', () => {
    beforeEach(() => {
        server.use(mockDiscoverProjects({ response: [] }))
        store().resetState()
        useDiscoverFavoritesFilterStore.getState().reset()
        store().addFavorite(dapp('Tinyman', 'DeFi'))
        store().addFavorite(dapp('Allo', 'Explorer'))
        store().addFavorite(dapp('Vestige', 'DeFi'))
    })

    it('Given favorites, when a query is typed in DeFi, then only matching DeFi rows show', async () => {
        renderFavorites()
        await screen.findByTestId(
            'discover_all_favorites_dapp_https://vestige.example',
        )
        act(() =>
            useDiscoverFavoritesFilterStore.getState().setCategory('DeFi'),
        )

        fireEvent.change(screen.getByTestId('discover_all_favorites_search'), {
            target: { value: 'tiny' },
        })

        await waitFor(() => {
            expect(rows()).toEqual([
                'discover_all_favorites_dapp_https://tinyman.example',
            ])
        })
        await flush()
    })

    it('Given favorites, when a query matches none, then No results shows instead of the explore prompt', async () => {
        renderFavorites()
        await screen.findByTestId(
            'discover_all_favorites_dapp_https://vestige.example',
        )

        fireEvent.change(screen.getByTestId('discover_all_favorites_search'), {
            target: { value: 'zzz' },
        })

        const empty = await screen.findByTestId(
            'discover_all_favorites_dapp_empty',
        )
        expect(empty.textContent).toContain('discover.search.no_results')
        expect(empty.textContent).not.toContain('discover.favorites.empty_body')
        await flush()
    })

    it('Given Rearrange, when a dApp is removed and Apply is tapped, then it leaves favorites', async () => {
        renderFavorites()
        fireEvent.click(
            await screen.findByTestId('discover_all_favorites_rearrange'),
        )
        fireEvent.click(
            await screen.findByTestId(
                'discover_rearrange_remove_https://allo.example',
            ),
        )
        fireEvent.click(screen.getByTestId('discover_rearrange_apply'))

        await waitFor(() => {
            expect(store().isFavorite('https://allo.example')).toBe(false)
        })
        expect(store().favoriteOrder).toHaveLength(2)
        await flush()
    })

    it('Given Rearrange, when a dApp is removed and Cancel is tapped, then nothing changes', async () => {
        renderFavorites()
        fireEvent.click(
            await screen.findByTestId('discover_all_favorites_rearrange'),
        )
        fireEvent.click(
            await screen.findByTestId(
                'discover_rearrange_remove_https://allo.example',
            ),
        )
        fireEvent.click(screen.getByTestId('discover_rearrange_cancel'))

        await flush()
        expect(store().isFavorite('https://allo.example')).toBe(true)
        expect(store().favoriteOrder).toHaveLength(3)
    })
})
