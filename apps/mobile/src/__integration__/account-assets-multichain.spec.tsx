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

import { Decimal } from 'decimal.js'
import { QueryClient } from '@tanstack/react-query'
import {
    hydrateAccountChainStates,
    insertAssetHolding,
    refreshAccountHoldings,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { mockCrossChainAssetGroups } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { http, HttpResponse } from 'msw'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { waitPastDoublePressGuard } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountOverviewModalContext } from '@modules/accounts/components/AccountOverview/AccountOverviewModalContext'
import { AccountAssetList } from '@modules/accounts/components/AccountAssetList'
import { useAssetListViewStore } from '@modules/accounts/hooks/useAssetListViewStore'
import { USDC_TEST_ASSET } from './__fixtures__/assets'
import {
    ALGO_SCOPE,
    ETH_USDC,
    LOOKALIKE,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
    USDC_GROUP,
} from './__fixtures__/multichainHoldings'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const BASE_RPC_URL = vi.hoisted(() => 'https://base.rpc.test/')

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
        // Base's node is always configured, and answers every read with a failure.
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'base'
                ? { mainnet: BASE_RPC_URL, sepolia: BASE_RPC_URL }
                : actual.chainEndpointsFor(chainId),
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

const BASE_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

const THREE_CHAIN_ACCOUNT: WalletAccount = {
    ...TWO_CHAIN_ACCOUNT,
    id: 'three-chains',
    chains: {
        ...TWO_CHAIN_ACCOUNT.chains,
        base: { address: BASE_ADDRESS, keyPairId: 'b-key' },
    },
}

// Algorand holds nothing here, Ethereum is funded.
const EMPTY_ALGORAND_ACCOUNT: WalletAccount = {
    ...TWO_CHAIN_ACCOUNT,
    id: 'empty-algorand',
    chains: {
        ...TWO_CHAIN_ACCOUNT.chains,
        algorand: { address: HD_TEST_ADDRESS, keyPairId: 'a2-key' },
    },
}

const openReceiveFundsOn = vi.fn()

const TabBarStub = () => {
    const route = useRoute() as unknown as { params: { screen: string } }
    return <span data-testid='tab_bar_stub'>{route.params.screen}</span>
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

const renderList = (account: WalletAccount, queryClient?: QueryClient) =>
    renderWithNavigation(
        () => (
            <AccountOverviewModalContext.Provider
                value={{
                    account,
                    openSendFunds: vi.fn(),
                    openReceiveFunds: vi.fn(),
                    openReceiveFundsOn,
                    openAccountOptions: vi.fn(),
                }}
            >
                <AccountAssetList account={account} />
            </AccountOverviewModalContext.Provider>
        ),
        'AccountAssetListHost',
        {
            queryClient,
            additionalScreens: [
                { name: 'AssetDetails', component: AssetDetailsStub },
                { name: 'TabBar', component: TabBarStub },
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
        openReceiveFundsOn.mockClear()
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

    it("Given Base was just added and its first read fails, when its chip is selected, then Base's native token shows at zero without a funding prompt, and No Matching Assets only follows a search", async () => {
        server.use(http.post(BASE_RPC_URL, () => HttpResponse.error()))
        useAccountsStore.getState().setAccounts([THREE_CHAIN_ACCOUNT])
        renderList(THREE_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')

        fireEvent.click(screen.getByTestId('asset_network_filter_base'))

        const native = await screen.findByTestId('asset_row_native')
        // The amount alone: no read vouches for the zero, so it has no fiat value.
        expect(within(native).getAllByText(/0\.00/)).toHaveLength(1)
        // A native coin's subtitle is its bare unit, never `<unit> · native`.
        expect(within(native).queryByText(/native/)).toBeNull()
        // The read failed, so the zero is a placeholder, not an unfunded balance.
        expect(screen.queryByTestId('network_funding_state')).toBeNull()
        expect(
            screen.queryByText('account_details.assets.nomatch_title'),
        ).toBeNull()

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: 'no such asset' },
        })

        expect(
            await screen.findByText('account_details.assets.nomatch_title'),
        ).toBeTruthy()
    })

    it("Given Base was just added with nothing on it, when its chip is selected, then the native token shows at zero under a Get started prompt whose Receive opens Base's QR, and the prompt goes once a balance arrives", async () => {
        server.use(...evmRpcHandlers({ rpcUrl: BASE_RPC_URL }))
        useAccountsStore.getState().setAccounts([THREE_CHAIN_ACCOUNT])
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
        renderList(THREE_CHAIN_ACCOUNT, queryClient)
        await screen.findByTestId('asset_group_row_usdc')

        fireEvent.click(screen.getByTestId('asset_network_filter_base'))

        const prompt = await screen.findByTestId('network_funding_state')
        // The amount and its fiat value: a read zero is worth zero, priced or not.
        expect(
            within(screen.getByTestId('asset_row_native')).getAllByText(
                /0\.00/,
            ),
        ).toHaveLength(2)
        expect(prompt.textContent).toContain(
            'account_details.assets.funding_title',
        )
        // Nothing buys or swaps onto Base in this build.
        expect(screen.queryByTestId('network_funding_buy_button')).toBeNull()
        expect(screen.queryByTestId('network_funding_swap_button')).toBeNull()
        expect(
            screen.queryByText('account_details.assets.nomatch_title'),
        ).toBeNull()

        fireEvent.click(screen.getByTestId('network_funding_receive_button'))
        expect(openReceiveFundsOn).toHaveBeenCalledWith(
            THREE_CHAIN_ACCOUNT,
            'base',
        )

        await refreshAccountHoldings({
            accountAddress: BASE_ADDRESS,
            scope: { chainId: 'base', networkId: 'mainnet' },
            holdings: [
                {
                    assetId: 'native',
                    amount: new Decimal('1000000000000000000'),
                },
            ],
        })
        await act(() =>
            queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        )

        await waitFor(() => {
            expect(screen.queryByTestId('network_funding_state')).toBeNull()
        })
    })

    it('Given an Algorand account holding nothing, when its Algorand chip is selected, then the prompt offers Buy, which opens Fund', async () => {
        await seedAlgorandAccountState({
            accountAddress: HD_TEST_ADDRESS,
            scope: ALGO_SCOPE,
            nativeBalance: new Decimal(0),
        })
        await insertAssetHolding({
            accountAddress: HD_TEST_ADDRESS,
            assetId: '0',
            scope: ALGO_SCOPE,
            amount: new Decimal(0),
        })
        // As at startup: the stored chain state says this account has been read.
        await hydrateAccountChainStates()
        useAccountsStore.getState().setAccounts([EMPTY_ALGORAND_ACCOUNT])
        renderList(EMPTY_ALGORAND_ACCOUNT)
        await screen.findByTestId('asset_network_filter_algorand')

        fireEvent.click(screen.getByTestId('asset_network_filter_algorand'))

        fireEvent.click(await screen.findByTestId('network_funding_buy_button'))

        expect((await screen.findByTestId('tab_bar_stub')).textContent).toBe(
            'Fund',
        )
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

    const typeSearch = (value: string) =>
        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value },
        })

    it("Given Base's native coin, which has no stored metadata, when 'eth' is searched on the Base chip, then Ether is listed and No Matching Assets is not", async () => {
        server.use(http.post(BASE_RPC_URL, () => HttpResponse.error()))
        useAccountsStore.getState().setAccounts([THREE_CHAIN_ACCOUNT])
        renderList(THREE_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')
        fireEvent.click(screen.getByTestId('asset_network_filter_base'))
        await screen.findByTestId('asset_row_native')
        typeSearch('no such asset')
        await screen.findByText('account_details.assets.nomatch_title')

        typeSearch('eth')

        await screen.findByTestId('asset_row_native')
        expect(
            screen.queryByText('account_details.assets.nomatch_title'),
        ).toBeNull()
    })

    it("Given All, when 'eth' is searched, then Ether on Ethereum and on Base are both listed, each naming its network", async () => {
        server.use(http.post(BASE_RPC_URL, () => HttpResponse.error()))
        useAccountsStore.getState().setAccounts([THREE_CHAIN_ACCOUNT])
        renderList(THREE_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')

        typeSearch('eth')

        await waitFor(() => {
            expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        })
        const rows = screen.getAllByTestId('asset_row_native')
        expect(rows).toHaveLength(2)
        expect(
            rows.map(row =>
                within(row).queryByTestId('chain_label_ethereum')
                    ? 'ethereum'
                    : within(row).queryByTestId('chain_label_base')
                      ? 'base'
                      : null,
            ),
        ).toEqual(expect.arrayContaining(['ethereum', 'base']))
        expect(screen.queryByTestId(`asset_row_${LOOKALIKE}`)).toBeNull()
    })

    it("Given the Ethereum chip, when 'usd coin' is searched, then both Ethereum USD Coin tokens are listed with no network label", async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')
        fireEvent.click(screen.getByTestId('asset_network_filter_ethereum'))
        await screen.findByTestId('asset_row_native')

        typeSearch('usd coin')

        await waitFor(() => {
            expect(screen.queryByTestId('asset_row_native')).toBeNull()
        })
        expect(screen.getByTestId(`asset_row_${ETH_USDC}`)).toBeTruthy()
        expect(screen.getByTestId(`asset_row_${LOOKALIKE}`)).toBeTruthy()
        expect(screen.queryByTestId('chain_label_ethereum')).toBeNull()
        expect(
            screen.queryByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`),
        ).toBeNull()
    })

    it('Given All and a search that keeps the USDC group, when the group is expanded, then each member names its network once', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')

        typeSearch('usd')
        await waitFor(() => {
            expect(screen.queryByTestId('asset_row_native')).toBeNull()
        })
        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))

        const ethereumMember = await screen.findByTestId(
            `asset_row_${ETH_USDC}`,
        )
        expect(
            within(ethereumMember).getAllByTestId('chain_label_ethereum'),
        ).toHaveLength(1)
    })

    it("Given All, when 'algo' and then an Algorand asset id are searched, then ALGO and that asset are found as before", async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)
        await screen.findByTestId('asset_group_row_usdc')

        typeSearch('algo')

        await waitFor(() => {
            expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        })
        expect(
            within(screen.getByTestId('asset_row_0')).getByTestId(
                'chain_label_algorand',
            ),
        ).toBeTruthy()

        typeSearch(USDC_TEST_ASSET.assetId)

        await screen.findByTestId(`asset_row_${USDC_TEST_ASSET.assetId}`)
        expect(screen.queryByTestId('asset_row_0')).toBeNull()
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
