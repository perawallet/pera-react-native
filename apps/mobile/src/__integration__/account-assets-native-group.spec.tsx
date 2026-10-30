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

// ETH on Ethereum and on Base is one coin to the user: the asset sync reads
// the backend's cross-chain group for each network's native coin, and All
// folds both into one row.

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
import { fireEvent, screen, within } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // The chain context reads its services here, not from `hasPeraService`.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum' || scope.chainId === 'base'
                ? new Set(['assets', 'prices'] as const)
                : withBackend.peraServicesFor(scope),
        config: {
            ...withBackend.config,
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const {
    hydrateAccountChainStates,
    insertAssetHolding,
    upsertAccountChainState,
    useAccountChainStateStore,
    useAccountsStore,
} = await import('@perawallet/wallet-core-accounts')
const { fetchAndPersistAssets, upsertAssetPrices } =
    await import('@perawallet/wallet-core-assets')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { peraEvmHandlers, unknownAssetItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountOverviewModalContext } =
    await import('@modules/accounts/components/AccountOverview/AccountOverviewModalContext')
const { AccountAssetList } =
    await import('@modules/accounts/components/AccountAssetList')
const { useAssetListViewStore } =
    await import('@modules/accounts/hooks/useAssetListViewStore')
const { Decimal } = await import('decimal.js')

const ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE_SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const ETH_GROUP = { id: 'eth', name: 'Ether', symbol: 'ETH' }

const ACCOUNT: WalletAccount = {
    id: 'ethereum-and-base',
    custody: { kind: 'local', seed: null },
    chains: {
        ethereum: { address: ADDRESS, keyPairId: 'e-key' },
        base: { address: ADDRESS, keyPairId: 'b-key' },
    },
    name: 'Ethereum and Base',
}

const nativeItem = (caip19: string) => ({
    ...unknownAssetItem(caip19),
    name: 'Ethereum',
    unit_name: 'ETH',
    fraction_decimals: 18,
    cross_chain_asset_group: ETH_GROUP,
})

const renderList = () =>
    renderWithNavigation(
        () => (
            <AccountOverviewModalContext.Provider
                value={{
                    account: ACCOUNT,
                    openSendFunds: vi.fn(),
                    openReceiveFunds: vi.fn(),
                    openReceiveFundsOn: vi.fn(),
                    openAccountOptions: vi.fn(),
                }}
            >
                <AccountAssetList account={ACCOUNT} />
            </AccountOverviewModalContext.Provider>
        ),
        'AccountAssetListHost',
    )

// 1.5 ETH at $2,000 on Ethereum; none on Base, which has no price yet.
const seedNativeHoldings = async () => {
    for (const [scope, amount] of [
        [ETH_SCOPE, '1500000000000000000'],
        [BASE_SCOPE, '0'],
    ] as const) {
        await upsertAccountChainState({
            accountAddress: ADDRESS,
            scope,
            nativeBalance: new Decimal(amount),
            chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
        })
        await insertAssetHolding({
            accountAddress: ADDRESS,
            assetId: 'native',
            scope,
            amount: new Decimal(amount),
        })
    }
    await upsertAssetPrices({
        prices: [{ assetId: 'native', usdPrice: new Decimal('2000') }],
        scope: ETH_SCOPE,
    })
    // As at startup: both networks have been read, so Base's zero is a balance.
    await hydrateAccountChainStates()
}

describe('Flow: native ETH across networks in the asset list', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountChainStateStore.getState().resetState()
        useRemoteConfigStore.getState().resetState()
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
        await seedNativeHoldings()
        useAccountsStore.getState().setAccounts([ACCOUNT])
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given the backend groups ETH on Ethereum and Base, when the asset sync runs and All renders, then one Ether row totals both networks, and expanding it names each network', async () => {
        server.use(
            ...peraEvmHandlers({
                assets: {
                    'eip155:1/slip44:60': nativeItem('eip155:1/slip44:60'),
                    'eip155:8453/slip44:60': nativeItem(
                        'eip155:8453/slip44:60',
                    ),
                },
            }),
        )
        await fetchAndPersistAssets(['native'], ETH_SCOPE)
        await fetchAndPersistAssets(['native'], BASE_SCOPE)

        renderList()

        const group = await screen.findByTestId('asset_group_row_eth')
        expect(screen.queryByTestId('asset_row_native')).toBeNull()
        // The symbol alone: the shared id is the chains' placeholder.
        expect(within(group).getByText('ETH')).toBeTruthy()
        expect(within(group).queryByText(/native/)).toBeNull()
        // Base holds none and has no price, so the total is Ethereum's alone.
        expect(within(group).getByText(/3,000\.00/)).toBeTruthy()

        fireEvent.click(group)

        const members = await screen.findAllByTestId('asset_row_native')
        expect(members).toHaveLength(2)
        const baseMember = members.find(member =>
            within(member).queryByTestId('chain_label_base'),
        )
        expect(baseMember).toBeDefined()
        // A zero holding is worth zero, priced or not.
        expect(within(baseMember!).getAllByText(/0\.00/)).toHaveLength(2)
    })
})
