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
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { View } from 'react-native'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { mockAssetGroups } from '@perawallet/wallet-core-assets/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { waitPastDoublePressGuard } from '@test-utils/rnw'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountAssetList } from '@modules/accounts/components/AccountAssetList'
import { useAssetListViewStore } from '@modules/accounts/hooks/useAssetListViewStore'
import { USDC_TEST_ASSET } from './__fixtures__/assets'
import {
    ETH_USDC,
    LOOKALIKE,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
    USDC_GROUP,
} from './__fixtures__/multichainHoldings'
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

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'algo-only',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
    },
    name: 'Algo only',
}

const AssetDetailsStub = ({
    route,
}: {
    route: { params: { assetId: string; chainId: ChainId } }
}) => (
    <View
        testID={`asset-details-${route.params.chainId}-${route.params.assetId}`}
    />
)

const renderList = (account: WalletAccount) =>
    renderWithNavigation(
        () => <AccountAssetList account={account} />,
        'AccountAssetListHost',
        {
            additionalScreens: [
                { name: 'AssetDetails', component: AssetDetailsStub },
            ],
        },
    )

const resetListView = () =>
    useAssetListViewStore.setState({
        selectedChainId: null,
        expandedGroupIds: [],
    })

describe("Flow: One account's assets across chains", () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        resetListView()
        server.use(mockAssetGroups({ response: { results: [USDC_GROUP] } }))
        await seedHoldings()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an account on Algorand and Ethereum, when its list renders, then chips read All, Algorand and Ethereum and USDC on both chains is one row', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])

        renderList(TWO_CHAIN_ACCOUNT)

        expect(screen.getByTestId('asset_network_filter_all')).toBeTruthy()
        expect(screen.getByTestId('asset_network_filter_algorand')).toBeTruthy()
        expect(screen.getByTestId('asset_network_filter_ethereum')).toBeTruthy()
        const group = await screen.findByTestId('asset_group_row_usdc')
        // 2.5 on Algorand plus 1.5 on Ethereum.
        expect(group.textContent).toMatch(/4\.00/)
        expect(screen.queryByTestId(`asset_row_${ETH_USDC}`)).toBeNull()
        expect(
            screen.queryByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`),
        ).toBeNull()
        // Same symbol, no group: its own row.
        expect(screen.getByTestId(`asset_row_${LOOKALIKE}`)).toBeTruthy()
    })

    it('Given the grouped row, when it is pressed, then it expands in place with the holding on each network under it, and pressing it again collapses it', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)

        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))

        const algorandMember = await screen.findByTestId(
            `asset_row_${USDC_TEST_ASSET.assetId}`,
        )
        const ethereumMember = screen.getByTestId(`asset_row_${ETH_USDC}`)
        expect(
            within(algorandMember).getByTestId('network_label_algorand'),
        ).toBeTruthy()
        expect(
            within(ethereumMember).getByTestId('network_label_ethereum'),
        ).toBeTruthy()
        expect(screen.queryByTestId(/^asset-details-/)).toBeNull()

        await waitPastDoublePressGuard()
        fireEvent.click(screen.getByTestId('asset_group_row_usdc'))

        await waitFor(() => {
            expect(screen.queryByTestId(`asset_row_${ETH_USDC}`)).toBeNull()
        })
    })

    it("Given the expanded group, when one network's row is pressed, then that network's details open", async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)

        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))
        fireEvent.click(await screen.findByTestId(`asset_row_${ETH_USDC}`))

        expect(
            await screen.findByTestId(`asset-details-ethereum-${ETH_USDC}`),
        ).toBeTruthy()
    })

    it('Given the Ethereum chip, when it is selected, then only Ethereum holdings show and nothing is grouped', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')

        fireEvent.click(screen.getByTestId('asset_network_filter_ethereum'))

        await screen.findByTestId(`asset_row_${ETH_USDC}`)
        expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        expect(screen.getByTestId(`asset_row_${LOOKALIKE}`)).toBeTruthy()
        expect(screen.queryByTestId('asset_row_0')).toBeNull()
        expect(
            screen.queryByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`),
        ).toBeNull()
    })

    it('Given a search by contract address, when it is typed, then the matching holding is found', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: LOOKALIKE.slice(0, 12) },
        })

        await waitFor(() => {
            expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        })
        expect(screen.getByTestId(`asset_row_${LOOKALIKE}`)).toBeTruthy()
    })

    it('Given Ethereum is selected, when the list is left and reopened, then Ethereum stays selected until a cold start', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        const first = renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')
        fireEvent.click(screen.getByTestId('asset_network_filter_ethereum'))
        await waitFor(() => {
            expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        })
        first.unmount()

        const second = renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId(`asset_row_${ETH_USDC}`)
        expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        second.unmount()

        // A cold start begins with a fresh, unpersisted store.
        act(() => resetListView())
        renderList(TWO_CHAIN_ACCOUNT)
        expect(await screen.findByTestId('asset_group_row_usdc')).toBeTruthy()
    })

    it('Given an account only on Algorand, when its list renders, then there are no chips and nothing is grouped', async () => {
        useAssetListViewStore.getState().setSelectedChainId('ethereum')
        useAccountsStore.getState().setAccounts([ALGORAND_ACCOUNT])

        renderList(ALGORAND_ACCOUNT)

        await screen.findByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`)
        expect(screen.queryByTestId('asset_network_filter_all')).toBeNull()
        expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        expect(screen.getByTestId('asset_row_0')).toBeTruthy()
    })
})
