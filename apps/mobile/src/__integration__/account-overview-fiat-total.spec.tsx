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
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'

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
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountAssetList } from '@modules/accounts/components/AccountAssetList'
import { AccountMenu } from '@modules/accounts/components/AccountMenu/AccountMenu'
import { useAssetListViewStore } from '@modules/accounts/hooks/useAssetListViewStore'
import { AccountOverviewHeader } from '@modules/accounts/components/AccountOverview/AccountOverviewHeader'
import { AccountOverviewModalContext } from '@modules/accounts/components/AccountOverview/AccountOverviewModalContext'
import { ETH_ADDRESS, ETH_SCOPE } from './__fixtures__/multichainHoldings'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

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

const ALGO_SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const ACCOUNT: WalletAccount = {
    id: 'algo-1',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' } },
    name: 'Algo main',
}

const seedAlgo = async (microAlgos: string, usdPrice: string) => {
    await seedAlgoAsset('mainnet')
    await seedAlgorandAccountState({
        accountAddress: ALGO25_TEST_ADDRESS,
        scope: ALGO_SCOPE,
        nativeBalance: new Decimal(microAlgos),
    })
    await insertAssetHolding({
        accountAddress: ALGO25_TEST_ADDRESS,
        assetId: '0',
        scope: ALGO_SCOPE,
        amount: new Decimal(microAlgos),
    })
    await upsertAssetPrices({
        prices: [{ assetId: '0', usdPrice: new Decimal(usdPrice) }],
        scope: ALGO_SCOPE,
    })
}

const BASE_SCOPE = { chainId: 'base', networkId: 'mainnet' } as const

// Ethereum and Base derive one address, so the two share a key in any
// address-keyed lookup.
const THREE_CHAIN_ACCOUNT: WalletAccount = {
    id: 'three-chains',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
        ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' },
        base: { address: ETH_ADDRESS, keyPairId: 'e-key' },
    },
    name: 'Three chains',
}

const noop = () => {}

// 0.15 ALGO at $0.102447 and 0.001 ETH at $3,140 on Ethereum; Base holds nothing.
const seedThreeChains = async () => {
    await seedAlgo('150000', '0.102447')

    const ether = nativeAssetFor('ethereum')
    await upsertAssets({ items: [ether], scope: ETH_SCOPE })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('1000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
    await insertAssetHolding({
        accountAddress: ETH_ADDRESS,
        assetId: ether.assetId,
        scope: ETH_SCOPE,
        amount: new Decimal('1000000000000000'),
    })
    await upsertAssetPrices({
        prices: [{ assetId: ether.assetId, usdPrice: new Decimal('3140') }],
        scope: ETH_SCOPE,
    })

    await upsertAssets({
        items: [nativeAssetFor('base')],
        scope: BASE_SCOPE,
    })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: BASE_SCOPE,
        nativeBalance: new Decimal(0),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
}

const renderOverview = (account: WalletAccount = ACCOUNT) =>
    renderWithNavigation(
        () => (
            <AccountOverviewModalContext.Provider
                value={{
                    account,
                    openSendFunds: noop,
                    openReceiveFunds: noop,
                    openReceiveFundsOn: noop,
                    openAccountOptions: noop,
                }}
            >
                <AccountOverviewHeader
                    account={account}
                    chartVisible={false}
                    isLoading={false}
                />
                <AccountAssetList account={account} />
            </AccountOverviewModalContext.Provider>
        ),
        'AccountOverviewHost',
    )

describe('Flow: Account overview fiat total', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useCurrenciesStore.getState().resetState()
    })

    it('Given 0.25 ALGO worth $0.025773, when the overview renders, then the header total and the ALGO row both read $0.03', async () => {
        await seedAlgo('250000', '0.103092')

        renderOverview()

        await waitFor(() => {
            expect(screen.getAllByText(/^\$ ?0\.03$/)).toHaveLength(2)
        })
        expect(
            screen.getByTestId('portfolio_primary_value').textContent,
        ).toMatch(/^\$ ?0\.03$/)
    })

    it('Given 0.01 ALGO worth $0.003, when the overview renders, then the header total and the ALGO row both read under a cent', async () => {
        await seedAlgo('10000', '0.30')

        renderOverview()

        await waitFor(() => {
            expect(screen.getAllByText(/^< \$ ?0\.01$/)).toHaveLength(2)
        })
    })

    describe('with the account on Algorand, Ethereum and Base', () => {
        beforeEach(async () => {
            await seedThreeChains()
            useAccountsStore.getState().setAccounts([THREE_CHAIN_ACCOUNT])
        })

        it('Given Ethereum holds the ETH, when All is selected, then the header total is the sum of the rows', async () => {
            renderOverview(THREE_CHAIN_ACCOUNT)

            await waitFor(() => {
                expect(
                    screen.getByTestId('portfolio_primary_value').textContent,
                ).toMatch(/^\$ ?3\.16$/)
            })
            expect(screen.getByText(/^\$ ?0\.02$/)).toBeTruthy()
            expect(screen.getByText(/^\$ ?3\.14$/)).toBeTruthy()
        })

        it('Given a network chip, when it is selected, then the header total still covers every network', async () => {
            renderOverview(THREE_CHAIN_ACCOUNT)
            await waitFor(() => {
                expect(
                    screen.getByTestId('portfolio_primary_value').textContent,
                ).toMatch(/^\$ ?3\.16$/)
            })

            fireEvent.click(screen.getByTestId('asset_network_filter_algorand'))
            await waitFor(() => {
                expect(screen.queryByText(/^\$ ?3\.14$/)).toBeNull()
            })
            expect(
                screen.getByTestId('portfolio_primary_value').textContent,
            ).toMatch(/^\$ ?3\.16$/)
        })

        it('Given the accounts list, when it renders, then the account row and the portfolio total include the ETH', async () => {
            renderWithNavigation(
                () => (
                    <AccountMenu
                        onSelected={noop}
                        onAddAccount={noop}
                        onOpenSort={noop}
                    />
                ),
                'AccountMenuHost',
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('portfolio_total_value').textContent,
                ).toMatch(/3\.16/)
            })
            expect(
                screen.getByTestId(
                    `account_switcher_row_${ALGO25_TEST_ADDRESS}`,
                ).textContent,
            ).toMatch(/3\.16/)
        })
    })
})
