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

// Add Asset with Ethereum registered beside Algorand: All lists both chains'
// assets with each row's network, a network chip narrows the list to that
// chain, and each chain offers the add action: Algorand by opt-in, Ethereum by
// recording the token, with no transaction.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
    getAddedTokenIdsByAccount,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    assetsAdapterFor,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { mockAssetSearch } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
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
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const ETHEREUM_MAINNET: ChainScope = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
}
const ETHEREUM_ADDRESS = '0x1111111111111111111111111111111111111111'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const ETHEREUM_LISTED: DisplayableAsset[] = [
    { assetId: 'native', name: 'Ether', unitName: 'ETH' },
    {
        assetId: DAI,
        name: 'Dai Stablecoin',
        unitName: 'DAI',
        peraMetadata: { verificationTier: 'verified' },
    },
]

describe('Flow: Add Asset with a second chain registered', () => {
    beforeEach(() => {
        useAccountsStore.getState().setAccounts([
            {
                id: 'watch-1',
                name: 'Watch',
                custody: { kind: 'watch' },
                chains: {
                    algorand: { address: ALGO25_TEST_ADDRESS },
                    ethereum: { address: ETHEREUM_ADDRESS },
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
        // Ethereum's token list comes from Pera services a CI build leaves
        // unconfigured, so its search is stubbed at the adapter; the chain
        // package's own tests cover the request and the matching.
        vi.spyOn(
            assetsAdapterFor(ETHEREUM_MAINNET),
            'search',
        ).mockImplementation(async ({ query }) => ({
            results: ETHEREUM_LISTED.filter(asset =>
                asset.name?.toLowerCase().includes(query.trim().toLowerCase()),
            ),
            nextCursor: undefined,
        }))
    })

    afterEach(() => {
        vi.restoreAllMocks()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    const renderAddAsset = (chainId: Nullable<ChainId>) =>
        renderWithNavigation(
            () => <AddAssetView chainId={chainId} />,
            'AddAsset',
        )

    it("Given Add Asset opens on All, then it lists both chains' assets, each with its network, and offers adding on both", async () => {
        renderAddAsset(null)

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
            expect(screen.getByText('Dai Stablecoin')).toBeTruthy()
        })
        expect(screen.getByText('Ether')).toBeTruthy()
        expect(screen.getByTestId('add_asset_network_filter_all')).toBeTruthy()
        expect(screen.getAllByTestId('chain_label_algorand')).toHaveLength(1)
        expect(screen.getAllByTestId('chain_label_ethereum')).toHaveLength(2)
        expect(
            screen.getByTestId('asset_search_item_add_31566704'),
        ).toBeTruthy()
        expect(screen.getByTestId(`asset_search_item_add_${DAI}`)).toBeTruthy()
        expect(screen.queryByTestId('asset_search_item_add_native')).toBeNull()
        expect(screen.queryByTestId('add_asset_partial_results')).toBeNull()
    })

    it("Given Add Asset opens on All, when Ethereum's search fails, then Algorand's assets show under a warning that some are missing", async () => {
        vi.mocked(assetsAdapterFor(ETHEREUM_MAINNET).search!).mockRejectedValue(
            new Error('Ethereum down'),
        )
        renderAddAsset(null)

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(screen.queryByText('Ether')).toBeNull()
        expect(screen.getByTestId('add_asset_partial_results')).toBeTruthy()
        expect(screen.getByText('add_asset.partial_results')).toBeTruthy()
    })

    it('Given Add Asset opens on Ethereum, when the user searches and then picks Algorand, then the list follows the chip and the search', async () => {
        renderAddAsset('ethereum' as ChainId)

        await waitFor(() => {
            expect(screen.getByText('Dai Stablecoin')).toBeTruthy()
        })
        expect(screen.getByText('Ether')).toBeTruthy()
        expect(screen.queryByText('USD Coin')).toBeNull()
        expect(screen.queryByTestId('chain_label_ethereum')).toBeNull()

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: 'dai' },
        })

        await waitFor(() => {
            expect(screen.queryByText('Ether')).toBeNull()
            expect(screen.getByText('Dai Stablecoin')).toBeTruthy()
        })

        fireEvent.click(screen.getByTestId('add_asset_network_filter_algorand'))

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(screen.queryByText('Dai Stablecoin')).toBeNull()
    })

    it('Given an account only on Algorand, then Add Asset shows no chips and lists Algorand assets only', async () => {
        useAccountsStore.getState().setAccounts([
            {
                id: 'watch-1',
                name: 'Watch',
                custody: { kind: 'watch' },
                chains: { algorand: { address: ALGO25_TEST_ADDRESS } },
            },
        ])
        renderAddAsset(null)

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(screen.queryByText('Dai Stablecoin')).toBeNull()
        expect(screen.queryByTestId('add_asset_network_filter_all')).toBeNull()
        expect(screen.queryByTestId('chain_label_algorand')).toBeNull()
    })

    it('Given Algorand cannot manage assets, when results load, then no row offers the add action', async () => {
        setCapabilityOverrides({ manageAssets: false }, 'algorand')
        renderAddAsset('algorand')

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(
            screen.queryByTestId('asset_search_item_add_31566704'),
        ).toBeNull()
    })
    describe('with a database to record added tokens', () => {
        beforeAll(setupTestDatabase)
        beforeEach(resetTestDatabase)
        afterAll(teardownTestDatabase)

        it('Given Add Asset opens on Ethereum, when + is tapped on a token, then it is added at once and its check offers Remove', async () => {
            vi.spyOn(
                assetsAdapterFor(ETHEREUM_MAINNET),
                'syncAssets',
            ).mockResolvedValue(undefined)
            renderAddAsset('ethereum' as ChainId)

            await waitFor(() => {
                expect(
                    screen.getByTestId(`asset_search_item_add_${DAI}`),
                ).toBeTruthy()
            })
            expect(
                screen.getByPlaceholderText('add_asset.search_placeholder_evm'),
            ).toBeTruthy()

            fireEvent.click(screen.getByTestId(`asset_search_item_add_${DAI}`))

            await waitFor(() => {
                expect(
                    screen.getByTestId(`asset_search_item_remove_${DAI}`),
                ).toBeTruthy()
            })
            expect(
                screen.queryByTestId(`asset_search_item_add_${DAI}`),
            ).toBeNull()
            expect(
                await getAddedTokenIdsByAccount({
                    accountAddresses: [ETHEREUM_ADDRESS],
                    scope: ETHEREUM_MAINNET,
                }),
            ).toEqual(new Map([[ETHEREUM_ADDRESS, [DAI]]]))
        })
    })
})
