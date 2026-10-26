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

// Add Asset with a second chain registered: only chains that can search assets
// get a network chip, the search follows the picked chip, and a chain that
// can't manage assets offers no add action.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { mockAssetSearch } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
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

describe('Flow: Add Asset with a second chain registered', () => {
    beforeEach(() => {
        useAccountsStore.getState().setAccounts([
            {
                id: 'watch-1',
                name: 'Watch',
                custody: { kind: 'watch' },
                chains: { algorand: { address: ALGO25_TEST_ADDRESS } },
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
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    const renderAddAsset = () =>
        renderWithNavigation(
            () => <AddAssetView chainId={LEGACY_CHAIN_ID} />,
            'AddAsset',
        )

    it('Given Ethereum is registered without asset search, when Add Asset opens, then it searches Algorand with no network chips', async () => {
        renderAddAsset()

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(
            screen.queryByTestId('add_asset_network_filter_algorand'),
        ).toBeNull()
        expect(
            screen.queryByTestId('add_asset_network_filter_ethereum'),
        ).toBeNull()
    })

    it('Given Ethereum can search assets, when the user picks Ethereum and then Algorand, then the search follows the picked chip', async () => {
        setCapabilityOverrides({ assetSearch: true }, 'ethereum')
        renderAddAsset()

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(
            screen.getByTestId('add_asset_network_filter_algorand'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('asset_search_item_add_31566704'),
        ).toBeTruthy()

        fireEvent.click(screen.getByTestId('add_asset_network_filter_ethereum'))

        await waitFor(() => {
            expect(screen.queryByText('USD Coin')).toBeNull()
        })

        fireEvent.click(screen.getByTestId('add_asset_network_filter_algorand'))

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
    })

    it('Given the picked chain can search but not manage assets, when results load, then the rows offer no add action', async () => {
        setCapabilityOverrides({ assetSearch: true }, 'ethereum')
        setCapabilityOverrides({ manageAssets: false }, 'algorand')
        renderAddAsset()

        await waitFor(() => {
            expect(screen.getByText('USD Coin')).toBeTruthy()
        })
        expect(
            screen.getByTestId('add_asset_network_filter_ethereum'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('asset_search_item_add_31566704'),
        ).toBeNull()
    })
})
