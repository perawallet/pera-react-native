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
import { useRoute } from '@react-navigation/native'

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { mockCrossChainAssetGroups } from '@perawallet/wallet-core-chain-algorand/test-handlers'
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

const AssetDetailsStub = () => {
    const route = useRoute() as unknown as {
        params: { assetId: string; chainId: string }
    }
    return (
        <span data-testid='asset_details_stub'>
            {`${route.params.chainId}:${route.params.assetId}`}
        </span>
    )
}

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
        server.use(
            mockCrossChainAssetGroups({
                groups: { [USDC_TEST_ASSET.assetId]: USDC_GROUP },
            }),
        )
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
        expect(
            within(
                screen.getByTestId('asset_network_filter_ethereum'),
            ).queryByTestId('chain_icon_ethereum'),
        ).toBeNull()
        const group = await screen.findByTestId('asset_group_row_usdc')
        // 2.5 on Algorand plus 1.5 on Ethereum.
        expect(group.textContent).toMatch(/4\.00/)
        // An svg is the chain's logo; the initials placeholder is a view.
        expect(within(group).getByTestId('chain_icon_ethereum').tagName).toBe(
            'svg',
        )
        expect(screen.queryByTestId(`asset_row_${ETH_USDC}`)).toBeNull()
        expect(
            screen.queryByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`),
        ).toBeNull()
        // Same symbol, no group: its own row.
        expect(screen.getByTestId(`asset_row_${LOOKALIKE}`)).toBeTruthy()
    })

    it('Given the grouped row, when it is pressed, then the holding on each network shows under it with its network', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)

        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))

        const algorandMember = await screen.findByTestId(
            `asset_row_${USDC_TEST_ASSET.assetId}`,
        )
        const ethereumMember = screen.getByTestId(`asset_row_${ETH_USDC}`)
        expect(
            within(algorandMember).getByTestId('chain_label_algorand'),
        ).toBeTruthy()
        expect(
            within(ethereumMember).getByTestId('chain_label_ethereum'),
        ).toBeTruthy()
        expect(screen.queryByTestId('asset_details_stub')).toBeNull()
    })

    it('Given the expanded group, when it is pressed again, then it collapses without opening any detail', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))
        await screen.findByTestId(`asset_row_${ETH_USDC}`)
        await waitPastDoublePressGuard()

        fireEvent.click(screen.getByTestId('asset_group_row_usdc'))

        await waitFor(() => {
            expect(screen.queryByTestId(`asset_row_${ETH_USDC}`)).toBeNull()
        })
        expect(
            screen.queryByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`),
        ).toBeNull()
        expect(screen.queryByTestId('asset_details_stub')).toBeNull()
    })

    it("Given the expanded group, when its Ethereum row is pressed, then Ethereum's own asset detail opens", async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))

        fireEvent.click(await screen.findByTestId(`asset_row_${ETH_USDC}`))

        const details = await screen.findByTestId('asset_details_stub')
        expect(details.textContent).toBe(`ethereum:${ETH_USDC}`)
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
