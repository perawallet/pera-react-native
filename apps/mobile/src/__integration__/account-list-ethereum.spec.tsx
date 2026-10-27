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
import { screen, waitFor, within } from '@testing-library/react'
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
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { setChainEnabled } from '@test-utils/capability-overrides'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountMenu } from '@modules/accounts/components/AccountMenu/AccountMenu'
import { ButtonPanel } from '@modules/accounts/components/ButtonPanel'
import { AccountOverviewModalContext } from '@modules/accounts/components/AccountOverview/AccountOverviewModalContext'
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
const ALGO_SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'algo-1',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' } },
    name: 'Algo main',
}

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-1',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' } },
    name: 'Eth main',
}

const noop = () => {}

const renderMenu = () =>
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

const rowOf = (account: WalletAccount) =>
    screen.getByTestId(
        `account_switcher_row_${Object.values(account.chains)[0]?.address}`,
    )

// 1.5 ETH at $2,000 (or unpriced) and 10 ALGO at $0.30.
const seedBalances = async ({ isEthPriced = true } = {}) => {
    await seedAlgoAsset('mainnet')
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
    await upsertAssetPrices({
        prices: [{ assetId: '0', usdPrice: new Decimal('0.30') }],
        scope: ALGO_SCOPE,
    })

    const eth = nativeAssetFor('ethereum')
    await upsertAssets({ items: [eth], scope: ETH_SCOPE })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('1500000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
    await insertAssetHolding({
        accountAddress: ETH_ADDRESS,
        assetId: eth.assetId,
        scope: ETH_SCOPE,
        amount: new Decimal('1500000000000000000'),
    })
    if (isEthPriced) {
        await upsertAssetPrices({
            prices: [{ assetId: eth.assetId, usdPrice: new Decimal('2000') }],
            scope: ETH_SCOPE,
        })
    }
}

describe('Flow: Account list with Ethereum registered', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        await seedBalances()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useCurrenciesStore.getState().resetState()
    })

    it('Given only Algorand accounts, when the account list renders, then rows carry no chain badge', async () => {
        useAccountsStore.getState().setAccounts([ALGORAND_ACCOUNT])

        renderMenu()

        const row = rowOf(ALGORAND_ACCOUNT)
        await waitFor(() => {
            expect(within(row).getByText('Algo main')).toBeTruthy()
        })
        expect(within(row).queryByText('Algorand')).toBeNull()
        expect(screen.getByText('portfolio.show_chart')).toBeTruthy()
    })

    it('Given an Algorand and an Ethereum account, when the list renders, then each row shows its chain badge and its own native balance', async () => {
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])

        renderMenu()

        const ethRow = rowOf(ETHEREUM_ACCOUNT)
        const algoRow = rowOf(ALGORAND_ACCOUNT)
        expect(within(ethRow).getByText('Ethereum')).toBeTruthy()
        expect(within(algoRow).getByText('Algorand')).toBeTruthy()
        await waitFor(() => {
            expect(within(ethRow).getByText(/1\.5/)).toBeTruthy()
        })
        // Each row prices its native balance on its own chain.
        await waitFor(() => {
            expect(within(ethRow).getByText(/3,000\.00/)).toBeTruthy()
        })
        expect(within(algoRow).getByText(/^\$ ?3\.00$/)).toBeTruthy()
    })

    it('Given an ALGO preference stored before the upgrade, when a multi-chain list renders, then the Ethereum row and the portfolio total are in fiat', async () => {
        getProvider().keyValueStorage.setItem(
            'currencies-store',
            JSON.stringify({
                state: { preferredCurrency: 'ALGO', fallbackCurrency: 'USD' },
                version: 1,
            }),
        )
        await useCurrenciesStore.persist.rehydrate()
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])

        renderMenu()

        await waitFor(() => {
            expect(
                within(rowOf(ETHEREUM_ACCOUNT)).getByText(/\$ ?3,000\.00/),
            ).toBeTruthy()
        })
        expect(within(rowOf(ETHEREUM_ACCOUNT)).queryByText(/10,000/)).toBeNull()
        // The ALGO row's fiat line stays in fiat rather than repeating the ALGO amount.
        await waitFor(() => {
            expect(
                within(rowOf(ALGORAND_ACCOUNT)).getByText(/^\$ ?3\.00$/),
            ).toBeTruthy()
        })
        await waitFor(() => {
            expect(
                screen.getByTestId('portfolio_total_value').textContent,
            ).toMatch(/\$ ?3,003\.00/)
        })
    })

    it('Given an Ethereum account on mainnet, when the portfolio header renders, then its fiat value is in the total', async () => {
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])

        renderMenu()

        // $3 of ALGO plus $3,000 of ETH.
        await waitFor(() => {
            expect(
                screen.getByTestId('portfolio_total_value').textContent,
            ).toMatch(/3,003\.00/)
        })
        // Ethereum has no balance history, so a chart would plot only the $3.
        expect(screen.queryByText('portfolio.show_chart')).toBeNull()
        expect(
            screen.queryByTestId('portfolio_total_partial_notice'),
        ).toBeNull()
    })

    it('Given the ETH balance has no price, when the list renders, then its row shows the fiat as unavailable and the total counts only the ALGO with a note', async () => {
        await resetTestDatabase()
        await seedBalances({ isEthPriced: false })
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])

        renderMenu()

        const ethRow = rowOf(ETHEREUM_ACCOUNT)
        await waitFor(() => {
            expect(within(ethRow).getByText(/1\.5/)).toBeTruthy()
        })
        await waitFor(() => {
            expect(within(ethRow).getByText('---')).toBeTruthy()
        })
        expect(within(ethRow).queryByText(/0\.00/)).toBeNull()
        await waitFor(() => {
            expect(
                screen.getByTestId('portfolio_total_value').textContent,
            ).toMatch(/^\$ ?3\.00$/)
        })
        expect(
            screen.getByTestId('portfolio_total_partial_notice'),
        ).toBeTruthy()
    })

    it('Given the Ethereum kill switch is off, when the list renders, then its account stays listed with the unavailable notice and out of the total', async () => {
        setChainEnabled('ethereum', false)
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])

        renderMenu()

        const ethRow = rowOf(ETHEREUM_ACCOUNT)
        expect(
            within(ethRow).getByTestId('account_chain_unavailable'),
        ).toBeTruthy()
        expect(
            within(rowOf(ALGORAND_ACCOUNT)).queryByTestId(
                'account_chain_unavailable',
            ),
        ).toBeNull()
        // Only the $3 of ALGO: the frozen ETH balance stays out of the total.
        await waitFor(() => {
            expect(
                screen.getByTestId('portfolio_total_value').textContent,
            ).toMatch(/^\$ ?3\.00$/)
        })
    })

    it('Given an Ethereum account is opened, when its actions render, then it offers send and receive but no Algorand-only action', () => {
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])

        renderWithNavigation(
            () => (
                <AccountOverviewModalContext.Provider
                    value={{
                        account: ETHEREUM_ACCOUNT,
                        openSendFunds: noop,
                        openReceiveFunds: noop,
                        openAccountOptions: noop,
                    }}
                >
                    <ButtonPanel />
                </AccountOverviewModalContext.Provider>
            ),
            'Panel',
        )

        expect(screen.getByTestId('receive_button')).toBeTruthy()
        expect(screen.getByTestId('send_button')).toBeTruthy()
        expect(screen.queryByTestId('swap_button')).toBeNull()
    })
})
