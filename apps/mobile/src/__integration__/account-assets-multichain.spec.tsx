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
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useRoute } from '@react-navigation/native'

import {
    insertAssetHolding,
    upsertAccountChainState,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    nativeAssetFor,
    upsertAssetPrices,
    upsertAssets,
} from '@perawallet/wallet-core-assets'
import { mockAssetGroups } from '@perawallet/wallet-core-assets/test-handlers'
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { waitPastDoublePressGuard } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountAssetList } from '@modules/accounts/components/AccountAssetList'
import { useAssetListViewStore } from '@modules/accounts/hooks/useAssetListViewStore'
import { USDC_TEST_ASSET } from './__fixtures__/assets'
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

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALGO_SCOPE: ChainScope = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
}

const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
// Calls itself USDC, but no group names it.
const LOOKALIKE = '0x1111111111111111111111111111111111111111'

const TWO_CHAIN_ACCOUNT: WalletAccount = {
    id: 'two-chains',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
        ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' },
    },
    name: 'Both chains',
}

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'algo-only',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
    },
    name: 'Algo only',
}

const USDC_GROUP = {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    logo_url: null,
    members: [
        {
            chain_id: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
            asset_id: USDC_TEST_ASSET.assetId,
        },
        { chain_id: 'eip155:1', asset_id: ETH_USDC },
    ],
}

// 10 ALGO and 2.5 USDC on Algorand; 1.5 ETH, 1.5 USDC and 7 of the lookalike
// on Ethereum.
const seedHoldings = async () => {
    await seedAlgoAsset('mainnet')
    await upsertAssets({ items: [USDC_TEST_ASSET], scope: ALGO_SCOPE })
    await seedAlgorandAccountState({
        accountAddress: ALGO25_TEST_ADDRESS,
        scope: ALGO_SCOPE,
        nativeBalance: new Decimal(10_000_000),
    })
    await insertAssetHolding({
        accountAddress: ALGO25_TEST_ADDRESS,
        assetId: '0',
        scope: ALGO_SCOPE,
        amount: new Decimal('10000000'),
    })
    await insertAssetHolding({
        accountAddress: ALGO25_TEST_ADDRESS,
        assetId: USDC_TEST_ASSET.assetId,
        scope: ALGO_SCOPE,
        amount: new Decimal('2500000'),
    })

    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            {
                ...ether,
                assetId: ETH_USDC,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
            },
            {
                ...ether,
                assetId: LOOKALIKE,
                name: 'USD Coin',
                unitName: 'USDC',
                decimals: 6,
            },
        ],
        scope: ETH_SCOPE,
    })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('1500000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
    for (const [assetId, amount] of [
        [ether.assetId, '1500000000000000000'],
        [ETH_USDC, '1500000'],
        [LOOKALIKE, '7000000'],
    ] as const) {
        await insertAssetHolding({
            accountAddress: ETH_ADDRESS,
            assetId,
            scope: ETH_SCOPE,
            amount: new Decimal(amount),
        })
    }
    await upsertAssetPrices({
        prices: [
            { assetId: '0', usdPrice: new Decimal('0.30') },
            { assetId: USDC_TEST_ASSET.assetId, usdPrice: new Decimal('1') },
        ],
        scope: ALGO_SCOPE,
    })
    await upsertAssetPrices({
        prices: [
            { assetId: ether.assetId, usdPrice: new Decimal('2000') },
            { assetId: ETH_USDC, usdPrice: new Decimal('1') },
        ],
        scope: ETH_SCOPE,
    })
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

    it('Given the grouped row, when it is pressed, then the holding on each network shows under it with its chain', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderList(TWO_CHAIN_ACCOUNT)

        fireEvent.click(await screen.findByTestId('asset_group_row_usdc'))

        const algorandMember = await screen.findByTestId(
            `asset_row_${USDC_TEST_ASSET.assetId}`,
        )
        const ethereumMember = screen.getByTestId(`asset_row_${ETH_USDC}`)
        expect(algorandMember.textContent).toContain('Algorand')
        expect(ethereumMember.textContent).toContain('Ethereum')
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
