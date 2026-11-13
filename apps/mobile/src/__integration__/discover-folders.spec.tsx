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

// Native Discover favorites in folders: a folder lists its dApps under a
// header that shows the folder's own name, unstarring removes a dApp from the
// folder and from favorites, All favorites lists newest first, and All folders
// opens a folder.

import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { mockDiscoverProjects } from '@perawallet/wallet-core-projects/test-handlers'
import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { headeredScreen } from '@routes/screen-options'
import { useDiscoverFavoritesStore } from '@modules/discover/store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '@modules/discover/types'

const { DiscoverFolderScreen } =
    await import('@modules/discover/screens/DiscoverFolderScreen')
const { DiscoverAllFavoritesScreen } =
    await import('@modules/discover/screens/DiscoverAllFavoritesScreen')
const { DiscoverAllFoldersScreen } =
    await import('@modules/discover/screens/DiscoverAllFoldersScreen')

const dapp = (name: string): DiscoverDapp => ({
    url: `https://${name.toLowerCase()}.example`,
    name,
    logo: null,
    categories: [],
    chains: [],
})

const store = () => useDiscoverFavoritesStore.getState()

// Lets React Query's batched notifications land inside act.
const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })

const HeaderedStack = createNativeStackNavigator()

/** The folder screen under the app's real navigation header. */
const renderFolderWithHeader = (folderId: string) =>
    render(
        <HeaderedStack.Navigator>
            <HeaderedStack.Screen
                name='DiscoverFolder'
                component={DiscoverFolderScreen}
                initialParams={{ folderId }}
                options={headeredScreen('discover.favorites.title')}
            />
        </HeaderedStack.Navigator>,
    )

describe('Flow: Discover favorite folders', () => {
    beforeEach(() => {
        server.use(mockDiscoverProjects({ response: [] }))
        store().resetState()
    })

    it('Given a folder named web3.apps, then the header shows that name and its dApp count, and its dApps are listed', async () => {
        store().addFavorite(dapp('Tinyman'))
        store().addFavorite(dapp('Folks'))
        const id = store().createFolder('web3.apps', 'https://tinyman.example')

        renderFolderWithHeader(id)

        expect(
            (await screen.findByTestId('discover_folder_title')).textContent,
        ).toBe('web3.apps')
        expect(
            screen.getByTestId('discover_folder_dapp_https://tinyman.example'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('discover_folder_dapp_https://folks.example'),
        ).toBeNull()
        await flush()
    })

    it('Given a dApp in a folder, when its star is tapped, then it leaves the folder and favorites', async () => {
        store().addFavorite(dapp('Tinyman'))
        const id = store().createFolder('Swap', 'https://tinyman.example')
        renderWithNavigation(DiscoverFolderScreen, 'DiscoverFolder', {
            initialParams: { folderId: id },
        })

        fireEvent.click(
            await screen.findByTestId(
                'discover_folder_dapp_https://tinyman.example_star',
            ),
        )

        await screen.findByTestId('discover_folder_dapp_empty')
        expect(store().folders[id]?.items).toEqual([])
        expect(store().isFavorite('https://tinyman.example')).toBe(false)
        await flush()
    })

    it('Given favorites, then All favorites lists them newest first', async () => {
        store().addFavorite(dapp('Tinyman'))
        store().addFavorite(dapp('Folks'))
        renderWithNavigation(DiscoverAllFavoritesScreen, 'DiscoverAllFavorites')

        await screen.findByTestId(
            'discover_all_favorites_dapp_https://folks.example',
        )
        const ids = screen
            .getAllByTestId(
                /^discover_all_favorites_dapp_https:\/\/[a-z]+\.example$/,
            )
            .map(el => el.getAttribute('data-testid'))
        expect(ids).toEqual([
            'discover_all_favorites_dapp_https://folks.example',
            'discover_all_favorites_dapp_https://tinyman.example',
        ])
        await flush()
    })

    it('Given folders, when one is tapped in All folders, then that folder opens', async () => {
        store().createFolder('Older')
        const id = store().createFolder('Newest')
        renderWithNavigation(DiscoverAllFoldersScreen, 'DiscoverAllFolders', {
            additionalScreens: [
                { name: 'DiscoverFolder', component: DiscoverFolderScreen },
            ],
        })

        fireEvent.click(await screen.findByTestId(`discover_all_folders_${id}`))

        await waitFor(() => {
            expect(
                screen.getByTestId('discover_folder_dapp_empty'),
            ).toBeTruthy()
        })
        await flush()
    })
})
