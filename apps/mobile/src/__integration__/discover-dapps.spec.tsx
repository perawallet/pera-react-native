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
// Native dApp directory with Ethereum registered beside Algorand: one request
// for every discover chain, chain and category chips, sort, the details
// sheet, and the Apply link. Nothing here opens the Discover web app.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Linking } from 'react-native'

import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    mockDiscoverProjects,
    type MockDiscoverProjectsParams,
} from '@perawallet/wallet-core-projects/test-handlers'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useWebViewStore } from '@modules/webview'
import { useDiscoverFavoritesStore } from '@modules/discover/store/useDiscoverFavoritesStore'

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

const { DiscoverDappsScreen } =
    await import('@modules/discover/screens/DiscoverDappsScreen/DiscoverDappsScreen')

type ProjectApiResponse = MockDiscoverProjectsParams['response'][number]

const project = (
    name: string,
    over: Partial<ProjectApiResponse> = {},
): ProjectApiResponse => ({
    id: `p-${name}`,
    name,
    url: `https://${name.toLowerCase()}.example`,
    description: `${name} description`,
    short_description: `${name} description`,
    logo_png: `https://pera.test/${name}.png`,
    verification_tier: 'unverified',
    categories: [{ id: 'c-dex', title: 'DEX' }],
    popularity_score: 1,
    chains: [],
    ...over,
})

// Read lazily: the chain registry is only populated once the setup has run.
const algorandCaip2 = (): string =>
    getChainDescriptor('algorand').networks.find(n => n.id === 'mainnet')
        ?.caip2 ?? ''

const projectsFor = (algorandCaip2: string): ProjectApiResponse[] => [
    project('Tinyman', {
        popularity_score: 5,
        chains: [algorandCaip2],
        verification_tier: 'verified',
    }),
    project('Folks', {
        popularity_score: 9,
        chains: [algorandCaip2],
        categories: [{ id: 'c-lend', title: 'Lending' }],
    }),
    project('Aave', {
        popularity_score: 3,
        chains: ['eip155:1'],
        categories: [{ id: 'c-lend', title: 'Lending' }],
    }),
]

const rowOf = (name: string) =>
    `discover_dapps_row_https://${name.toLowerCase()}.example`

const rowNames = () =>
    screen
        .getAllByTestId(/^discover_dapps_row_https:\/\/[a-z]+\.example$/)
        .map(row => row.getAttribute('data-testid'))

const useHandlers = ({ ethereumEmpty = false } = {}) => {
    const all = projectsFor(algorandCaip2())
    server.use(
        mockDiscoverProjects({
            response: ethereumEmpty
                ? all.filter(p => !p.chains.includes('eip155:1'))
                : all,
        }),
    )
}

const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })

const renderDirectory = () =>
    renderWithNavigation(DiscoverDappsScreen, 'DiscoverDapps', {
        additionalScreens: [
            {
                name: 'DiscoverSearch',
                component: () => <div data-testid='search_screen' />,
            },
            {
                name: 'DiscoverDetail',
                component: () => <div data-testid='detail_screen' />,
            },
        ],
    })

describe('Flow: Discover dApp directory', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        useDiscoverFavoritesStore.getState().resetState()
        useWebViewStore.getState().clearWebViews()
        setCapabilityOverrides({ discover: true }, 'ethereum')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('Given All, then every chain lists by popularity with chain icons', async () => {
        useHandlers()
        renderDirectory()

        await screen.findByTestId(rowOf('Folks'))
        expect(rowNames()).toEqual([
            rowOf('Folks'),
            rowOf('Tinyman'),
            rowOf('Aave'),
        ])
        expect(screen.getByTestId('discover_dapps_chain_all')).toBeTruthy()
        await flush()
    })

    it('Given the Ethereum chip, then only Ethereum dApps remain', async () => {
        useHandlers()
        renderDirectory()
        await screen.findByTestId(rowOf('Folks'))

        fireEvent.click(screen.getByTestId('discover_dapps_chain_ethereum'))

        await waitFor(() => expect(rowNames()).toEqual([rowOf('Aave')]))
        await flush()
    })

    it('Given Ethereum has no dApps, then the empty copy shows and no category row', async () => {
        useHandlers({ ethereumEmpty: true })
        renderDirectory()
        await screen.findByTestId(rowOf('Folks'))

        fireEvent.click(screen.getByTestId('discover_dapps_chain_ethereum'))

        expect(await screen.findByTestId('discover_dapps_empty')).toBeTruthy()
        expect(
            screen.queryByTestId('discover_dapps_category_filter'),
        ).toBeNull()
        await flush()
    })

    it('Given A-Z, then the rows reorder by name', async () => {
        useHandlers()
        renderDirectory()
        await screen.findByTestId(rowOf('Folks'))

        fireEvent.click(screen.getByTestId('discover_dapps_sort'))
        fireEvent.click(
            await screen.findByText('discover.dapps.sort_alphabetical'),
        )

        await waitFor(() =>
            expect(rowNames()).toEqual([
                rowOf('Aave'),
                rowOf('Folks'),
                rowOf('Tinyman'),
            ]),
        )
        await flush()
    })

    it('Given a category chip, then only that category lists', async () => {
        useHandlers()
        renderDirectory()
        await screen.findByTestId(rowOf('Folks'))

        fireEvent.click(screen.getByTestId('discover_dapps_category_DEX'))

        await waitFor(() => expect(rowNames()).toEqual([rowOf('Tinyman')]))
        await flush()
    })

    it('Given Details, then the sheet shows the description and Open pushes the dApp', async () => {
        useHandlers()
        renderDirectory()
        await screen.findByTestId(rowOf('Tinyman'))

        fireEvent.click(screen.getByTestId(`${rowOf('Tinyman')}_details`))

        expect(
            (await screen.findByTestId('discover_dapp_details_description'))
                .textContent,
        ).toBe('Tinyman description')
        fireEvent.click(screen.getByTestId('discover_dapp_details_open'))

        await waitFor(() =>
            expect(
                useWebViewStore.getState().openWebViews.map(w => w.url),
            ).toEqual(['https://tinyman.example']),
        )
        expect(screen.queryByTestId('detail_screen')).toBeNull()
        await flush()
    })

    it('Given a dApp with no description or banner, then its sheet still opens without About', async () => {
        server.use(
            mockDiscoverProjects({
                response: [
                    project('Bare', {
                        description: '',
                        chains: [algorandCaip2()],
                    }),
                ],
            }),
        )
        renderDirectory()
        await screen.findByTestId(rowOf('Bare'))

        fireEvent.click(screen.getByTestId(`${rowOf('Bare')}_details`))

        expect(
            await screen.findByTestId('discover_dapp_details_open'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('discover_dapp_details_description'),
        ).toBeNull()
        await flush()
    })

    it('Given Apply, then the verification page opens in the system browser', async () => {
        const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
        useHandlers()
        renderDirectory()
        await screen.findByTestId(rowOf('Folks'))

        fireEvent.click(screen.getByTestId('discover_dapps_apply_button'))

        expect(openURL).toHaveBeenCalledWith(
            'https://explorer.perawallet.app/project-verification/',
        )
        await flush()
    })
})
