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
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
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

const SWITCH_OFF = '{"enabled":false}'
const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALGO_SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const

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

const switchEthereum = (value: string | null) =>
    useRemoteConfigStore
        .getState()
        .setConfigOverride('chain_ethereum_overrides', value)

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

const renderPanel = (account: WalletAccount) =>
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
                <ButtonPanel />
            </AccountOverviewModalContext.Provider>
        ),
        'Panel',
    )

const rowOf = (account: WalletAccount) =>
    screen.getByTestId(
        `account_switcher_row_${Object.values(account.chains)[0]?.address}`,
    )

// 1.5 ETH at $2,000 and 10 ALGO at $0.30.
const seedBalances = async () => {
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
    await upsertAssetPrices({
        prices: [{ assetId: eth.assetId, usdPrice: new Decimal('2000') }],
        scope: ETH_SCOPE,
    })
}

describe('Flow: Ethereum switched off remotely, then back on', () => {
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
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useCurrenciesStore.getState().resetState()
    })

    it("Given Ethereum's kill switch is on, when the list renders, then both accounts keep their balances in the total and neither row shows an unavailable notice", async () => {
        switchEthereum(SWITCH_OFF)

        renderMenu()

        await waitFor(() => {
            expect(
                within(rowOf(ETHEREUM_ACCOUNT)).getByText(/3,000\.00/),
            ).toBeTruthy()
        })
        expect(
            within(rowOf(ALGORAND_ACCOUNT)).getByText(/^\$ ?3\.00$/),
        ).toBeTruthy()
        expect(screen.queryByTestId('account_chain_unavailable')).toBeNull()
        await waitFor(() => {
            expect(
                screen.getByTestId('portfolio_total_value').textContent,
            ).toMatch(/3,003\.00/)
        })
    })

    it.each([
        ['Ethereum', ETHEREUM_ACCOUNT],
        ['Algorand', ALGORAND_ACCOUNT],
    ])(
        "Given Ethereum's kill switch is on, when a %s account's actions render, then it still offers send and receive",
        (_chain, account) => {
            switchEthereum(SWITCH_OFF)

            renderPanel(account)

            expect(screen.getByTestId('send_button')).toBeTruthy()
            expect(screen.getByTestId('receive_button')).toBeTruthy()
        },
    )

    it('Given the kill switch is turned off again, when the list renders, then the balances are the same', async () => {
        switchEthereum(SWITCH_OFF)
        switchEthereum(null)

        renderMenu()

        await waitFor(() => {
            expect(
                within(rowOf(ETHEREUM_ACCOUNT)).getByText(/3,000\.00/),
            ).toBeTruthy()
        })
        expect(
            within(rowOf(ALGORAND_ACCOUNT)).getByText(/^\$ ?3\.00$/),
        ).toBeTruthy()
    })
})
