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

// A wallet holding on Algorand and Ethereum gets one portfolio chart summed
// over both chains. Algorand's wealth series and Ethereum's valued balance
// grid share no timestamps, so the sum starts where both have a value and
// carries each chain's latest value forward. Copy is asserted by key: this
// project renders i18n keys.

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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // The chain context reads its services here, not from `hasPeraService`.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? new Set([
                      'blockFollowing',
                      'assets',
                      'prices',
                      'history',
                  ] as const)
                : withBackend.peraServicesFor(scope),
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
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
const { insertAssetHolding, upsertAccountChainState, useAccountsStore } =
    await import('@perawallet/wallet-core-accounts')
const { nativeAssetFor, upsertAssetPrices, upsertAssets } =
    await import('@perawallet/wallet-core-assets')
const { LEGACY_CHAIN_ID } =
    await import('@perawallet/wallet-core-chain-contract')
const { useSettingsStore } = await import('@perawallet/wallet-core-settings')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { mockAccountsBalanceHistory } =
    await import('@perawallet/wallet-core-chain-algorand/test-handlers')
const { peraEvmHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} = await import('@test-utils/database-setup')
const { AccountMenu } =
    await import('@modules/accounts/components/AccountMenu/AccountMenu')
const { ALGO25_TEST_ADDRESS } = await import('./__fixtures__/onboarding')
const { Decimal } = await import('decimal.js')

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ALGO_SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const ETH_CAIP19 = 'eip155:1/slip44:60'

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

const HOUR = 3_600_000
const NOW = Date.now()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

// 10 ALGO at $0.30 and 1.5 ETH at $2,000 are held now.
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

// Algorand's wealth series: $2 a day ago, $3 half an hour ago.
const serveAlgorandHistory = () =>
    server.use(
        mockAccountsBalanceHistory({
            response: {
                results: [
                    {
                        datetime: ago(24 * HOUR),
                        usd_value: '2',
                        algo_value: '6.67',
                        round: 1,
                    },
                    {
                        datetime: ago(HOUR / 2),
                        usd_value: '3',
                        algo_value: '10',
                        round: 2,
                    },
                ],
            },
        }),
    )

// Ethereum holds 1.5 ETH on its one grid point, 23 hours ago, then at today's
// price on the "now" point the app adds. ETH was $1,000 until an hour ago.
const serveEthereumHistory = (balanceHistory?: number) =>
    server.use(
        ...peraEvmHandlers({
            balanceHistory: balanceHistory ?? {
                results: [
                    {
                        timestamp: ago(23 * HOUR),
                        error: null,
                        balances: {
                            [ETH_ADDRESS]: {
                                [ETH_CAIP19]: '1500000000000000000',
                            },
                        },
                    },
                ],
            },
            charts: {
                [ETH_CAIP19]: [
                    {
                        datetime: ago(24 * HOUR),
                        price: new Decimal('1000').toFixed(24),
                    },
                    {
                        datetime: ago(HOUR),
                        price: new Decimal('2000').toFixed(24),
                    },
                ],
            },
        }),
    )

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

describe('Flow: Portfolio chart across Algorand and Ethereum', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useSettingsStore.getState().clearAllPreferences()
        await seedBalances()
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given both chains have history, when the chart is shown, then the trend is the sum across them from the first time both have a value', async () => {
        serveAlgorandHistory()
        serveEthereumHistory()

        renderMenu()
        fireEvent.click(await screen.findByText('portfolio.show_chart'))

        // $2 + $1,500 at the start (Ethereum's first point), $3 + $3,000 now.
        // Algorand alone would read +$1, Ethereum alone +$1,500.
        await waitFor(
            () => {
                expect(screen.getByText(/1,501\.00/)).toBeTruthy()
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByTestId('balance-chart-retry')).toBeNull()
    })

    it('Given Algorand has no history and Ethereum does, when the chart is shown, then it plots Ethereum instead of an empty chart', async () => {
        server.use(mockAccountsBalanceHistory({ response: { results: [] } }))
        serveEthereumHistory()

        renderMenu()
        fireEvent.click(await screen.findByText('portfolio.show_chart'))

        // $1,500 at Ethereum's first point, $3,000 now.
        await waitFor(
            () => {
                expect(screen.getByText(/1,500\.00/)).toBeTruthy()
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByText('common.wealth_chart.empty_body')).toBeNull()
    })

    it('Given the chart is hidden, when the portfolio renders, then no history is requested', async () => {
        serveAlgorandHistory()
        serveEthereumHistory()
        const requested: string[] = []
        server.events.on('request:start', ({ request }) => {
            requested.push(request.url)
        })

        try {
            renderMenu()
            await screen.findByText('portfolio.show_chart')
            await waitFor(() => {
                expect(
                    screen.getByTestId('portfolio_total_value').textContent,
                ).toMatch(/3,003\.00/)
            })
        } finally {
            server.events.removeAllListeners()
        }

        expect(
            requested.filter(url => /wealth|balance-history/.test(url)),
        ).toEqual([])
    })

    it("Given Ethereum's history fails, when the chart is shown, then it offers a retry instead of plotting Algorand alone", async () => {
        serveAlgorandHistory()
        serveEthereumHistory(503)

        renderMenu()
        fireEvent.click(await screen.findByText('portfolio.show_chart'))

        expect(
            await screen.findByTestId('balance-chart-retry', undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            }),
        ).toBeTruthy()
        // No change is shown rather than a 0% the wallet never had.
        expect(screen.queryByText('portfolio.last_7_days')).toBeNull()
    })
})
