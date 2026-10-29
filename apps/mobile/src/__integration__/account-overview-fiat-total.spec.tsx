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
import { screen, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'

import {
    insertAssetHolding,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { upsertAssetPrices } from '@perawallet/wallet-core-assets'
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
import { AccountOverviewHeader } from '@modules/accounts/components/AccountOverview/AccountOverviewHeader'
import { AccountOverviewModalContext } from '@modules/accounts/components/AccountOverview/AccountOverviewModalContext'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

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

const ALGO_SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const ACCOUNT: WalletAccount = {
    id: 'algo-1',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' } },
    name: 'Algo main',
}

const noop = () => {}

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

const renderOverview = () =>
    renderWithNavigation(
        () => (
            <AccountOverviewModalContext.Provider
                value={{
                    account: ACCOUNT,
                    openSendFunds: noop,
                    openReceiveFunds: noop,
                    openReceiveFundsOn: noop,
                    openAccountOptions: noop,
                }}
            >
                <AccountOverviewHeader
                    account={ACCOUNT}
                    chartVisible={false}
                    isLoading={false}
                />
                <AccountAssetList account={ACCOUNT} />
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
})
