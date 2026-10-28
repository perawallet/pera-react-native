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

// Add Asset with Ethereum and Base registered beside Algorand: a second EVM
// chain lists its tokens with codec-truncated contract addresses and filters
// by search, and a chain the backend refuses is named at once and never asked
// again.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    assetsAdapterFor,
    useAssetSearchAvailabilityStore,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { mockAssetSearch } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    PeraNetworkError,
    PeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import { AddAssetView } from '@modules/assets/components/AddAssetView'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
        },
    }
})

const ETHEREUM_MAINNET: ChainScope = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
}
const BASE_MAINNET: ChainScope = {
    chainId: 'base' as ChainId,
    networkId: 'mainnet',
}
const EVM_ADDRESS = '0x1111111111111111111111111111111111111111'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const AERO = '0x940181a94A35A4569E4529A3CDfB74e38FD98631'
const ETHEREUM_LISTED: DisplayableAsset[] = [
    { assetId: 'native', name: 'Ether', unitName: 'ETH' },
    { assetId: DAI, name: 'Dai Stablecoin', unitName: 'DAI' },
]
const BASE_LISTED: DisplayableAsset[] = [
    { assetId: 'native', name: 'Base Ether', unitName: 'ETH' },
    { assetId: AERO, name: 'Aerodrome', unitName: 'AERO' },
]

const matching =
    (listed: DisplayableAsset[]) =>
    async ({ query }: { query: string }) => ({
        results: listed.filter(asset =>
            asset.name?.toLowerCase().includes(query.trim().toLowerCase()),
        ),
        nextCursor: undefined,
    })

describe('Flow: Add Asset with a second EVM chain registered', () => {
    beforeEach(() => {
        useAccountsStore.getState().setAccounts([
            {
                id: 'watch-1',
                name: 'Watch',
                custody: { kind: 'watch' },
                chains: {
                    algorand: { address: ALGO25_TEST_ADDRESS },
                    ethereum: { address: EVM_ADDRESS },
                    base: { address: EVM_ADDRESS },
                },
            },
        ])
        useAccountsStore.getState().setSelectedAccountId('watch-1')
        server.use(
            mockAssetSearch({
                response: {
                    results: [
                        {
                            asset_id: 31_566_704,
                            name: 'USD Coin',
                            unit_name: 'USDC',
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
        // The test config lists no Pera services for any EVM network, so each
        // EVM search is stubbed at the adapter; the chain package's own tests
        // cover the request and the matching.
        vi.spyOn(
            assetsAdapterFor(ETHEREUM_MAINNET),
            'search',
        ).mockImplementation(matching(ETHEREUM_LISTED))
        vi.spyOn(assetsAdapterFor(BASE_MAINNET), 'search').mockImplementation(
            matching(BASE_LISTED),
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
        useAssetSearchAvailabilityStore.getState().resetState()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    const renderAddAsset = (chainId: Nullable<ChainId>) =>
        renderWithNavigation(
            () => <AddAssetView chainId={chainId} />,
            'AddAsset',
        )

    it("Given Add Asset opens on Base, then it lists Base's tokens with their addresses shortened, search filters them, and Ethereum's chip lists Ethereum's", async () => {
        renderAddAsset('base' as ChainId)

        await waitFor(() => {
            expect(screen.getByText('Aerodrome')).toBeTruthy()
        })
        expect(screen.getByText('AERO · 0x9401...8631')).toBeTruthy()
        expect(screen.queryByText(AERO, { exact: false })).toBeNull()
        expect(screen.queryByText('Dai Stablecoin')).toBeNull()

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: 'aero' },
        })

        await waitFor(() => {
            expect(screen.getByText('Aerodrome')).toBeTruthy()
            expect(screen.queryByText('Base Ether')).toBeNull()
        })

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: '' },
        })
        fireEvent.click(screen.getByTestId('add_asset_network_filter_ethereum'))

        await waitFor(() => {
            expect(screen.getByText('Dai Stablecoin')).toBeTruthy()
        })
        expect(screen.queryByText('Aerodrome')).toBeNull()
    })

    it("Given the backend has not switched Base on, when Add Asset opens on All and the user picks Base, then Base's state shows at once, with no skeletons, and Base is never asked again", async () => {
        const baseSearch = vi
            .mocked(assetsAdapterFor(BASE_MAINNET).search!)
            .mockRejectedValue(
                new PeraNetworkError('client', {
                    status: 422,
                    backendCode: 'chain_not_enabled',
                }),
            )
        renderAddAsset(null)

        await waitFor(() => {
            expect(screen.getByText('Dai Stablecoin')).toBeTruthy()
        })
        expect(screen.getByText('USD Coin')).toBeTruthy()
        expect(screen.queryByTestId('add_asset_partial_results')).toBeNull()

        fireEvent.click(screen.getByTestId('add_asset_network_filter_base'))

        expect(screen.getByText('add_asset.not_listed.title')).toBeTruthy()
        expect(screen.getByText('add_asset.not_listed.body')).toBeTruthy()

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: 'aero' },
        })

        await act(async () => {
            await new Promise(resolve =>
                setTimeout(resolve, SEARCH_DEBOUNCE_TIME + 100),
            )
        })

        expect(screen.getByText('add_asset.not_listed.title')).toBeTruthy()
        expect(baseSearch).toHaveBeenCalledTimes(1)
    })

    it('Given Add Asset opens straight on Base and the backend does not know the chain, then no wrong state shows while the first request is in flight, the not-listed state follows, and picking Base again asks nothing', async () => {
        let refuse: (error: Error) => void = () => undefined
        const baseSearch = vi
            .mocked(assetsAdapterFor(BASE_MAINNET).search!)
            .mockImplementation(
                () =>
                    new Promise((_resolve, reject) => {
                        refuse = reject
                    }),
            )
        renderAddAsset('base' as ChainId)

        await waitFor(() => {
            expect(baseSearch).toHaveBeenCalledTimes(1)
        })
        expect(screen.queryByText('add_asset.not_listed.title')).toBeNull()
        expect(screen.queryByText('add_asset.no_results')).toBeNull()

        await act(async () => {
            refuse(
                new PeraNetworkError('client', {
                    status: 422,
                    backendCode: 'unknown_chain',
                }),
            )
        })

        await waitFor(() => {
            expect(screen.getByText('add_asset.not_listed.title')).toBeTruthy()
        })

        fireEvent.click(screen.getByTestId('add_asset_network_filter_ethereum'))
        await waitFor(() => {
            expect(screen.getByText('Dai Stablecoin')).toBeTruthy()
        })
        fireEvent.click(screen.getByTestId('add_asset_network_filter_base'))

        expect(screen.getByText('add_asset.not_listed.title')).toBeTruthy()
        expect(baseSearch).toHaveBeenCalledTimes(1)
    })

    it('Given a network with no Pera services, when Add Asset opens on its chip, then it keeps the default network-unavailable copy rather than saying the chain is not listed', async () => {
        vi.mocked(assetsAdapterFor(BASE_MAINNET).search!).mockRejectedValue(
            new PeraServiceUnavailableError(BASE_MAINNET, 'assets'),
        )
        renderAddAsset('base' as ChainId)

        await waitFor(() => {
            expect(
                screen.getByText('common.network_unavailable.title'),
            ).toBeTruthy()
        })
        expect(screen.getByText('common.network_unavailable.body')).toBeTruthy()
        expect(screen.queryByText('add_asset.not_listed.title')).toBeNull()
    })
})
