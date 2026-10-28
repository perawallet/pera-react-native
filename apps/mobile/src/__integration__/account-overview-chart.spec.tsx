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

// The account chart plots the account's total across every chain the headline
// counts, so a chain that can't serve history makes the chart unavailable
// rather than a partial line. Copy is asserted by key: this project renders
// i18n keys.

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
import { screen } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'
import {
    ETH_ADDRESS,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    const { isEvmChainId } =
        await import('@perawallet/wallet-core-chain-contract')
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        // The chain context reads services from here, not hasPeraService.
        peraServicesFor: (scope: ChainScope) =>
            isEvmChainId(scope.chainId)
                ? new Set(['blockFollowing', 'assets', 'prices', 'history'])
                : withBackend.peraServicesFor(scope),
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { mockAccountsBalanceHistory } =
    await import('@perawallet/wallet-core-chain-algorand/test-handlers')
const { peraEvmHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountOverviewHeader } =
    await import('@modules/accounts/components/AccountOverview/AccountOverviewHeader')
const { AccountOverviewModalContext } =
    await import('@modules/accounts/components/AccountOverview/AccountOverviewModalContext')

const ETH_NATIVE = 'eip155:1/slip44:60'
const ALGORAND_HISTORY_PATH = '/v1/wallet/wealth/'
const ETHEREUM_HISTORY_PATH = '/balance-history/'

// A second account keeps the header off the lone-empty-wallet "get started"
// layout, which has no chart.
const OTHER_ACCOUNT: WalletAccount = {
    id: 'other',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: `0x${'1'.repeat(40)}` } },
    name: 'Other',
}

const noop = () => {}

const renderHeader = (chartVisible: boolean) =>
    renderWithNavigation(
        () => (
            <AccountOverviewModalContext.Provider
                value={{
                    account: TWO_CHAIN_ACCOUNT,
                    openSendFunds: noop,
                    openReceiveFunds: noop,
                    openAccountOptions: noop,
                }}
            >
                <AccountOverviewHeader
                    account={TWO_CHAIN_ACCOUNT}
                    chartVisible={chartVisible}
                    isLoading={false}
                />
            </AccountOverviewModalContext.Provider>
        ),
        'AccountOverviewHost',
    )

describe('Flow: The balance chart of an account on Algorand and Ethereum', () => {
    const requests = { algorand: 0, ethereum: 0 }

    /** `ethereum` in wei by timestamp; omitted, the backend serves no Ethereum balance history. */
    const serveHistory = ({
        algorand,
        ethereum,
    }: {
        algorand: { datetime: string; usd_value: string }[]
        ethereum?: { timestamp: string; wei: string }[]
    }) =>
        server.use(
            mockAccountsBalanceHistory({
                response: {
                    results: algorand.map((point, round) => ({
                        ...point,
                        algo_value: point.usd_value,
                        round,
                    })),
                },
            }),
            ...peraEvmHandlers(
                ethereum && {
                    balanceHistory: {
                        results: ethereum.map(({ timestamp, wei }) => ({
                            timestamp,
                            error: null,
                            balances: { [ETH_ADDRESS]: { [ETH_NATIVE]: wei } },
                        })),
                    },
                    charts: {
                        [ETH_NATIVE]: ethereum.map(({ timestamp }) => ({
                            datetime: timestamp,
                            price: '2000.000000000000000000000000',
                        })),
                    },
                },
            ),
        )

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        requests.algorand = 0
        requests.ethereum = 0
        server.events.on('request:start', ({ request }) => {
            if (request.url.includes(ALGORAND_HISTORY_PATH)) {
                requests.algorand += 1
            } else if (request.url.includes(ETHEREUM_HISTORY_PATH)) {
                requests.ethereum += 1
            }
        })
        useAccountsStore
            .getState()
            .setAccounts([TWO_CHAIN_ACCOUNT, OTHER_ACCOUNT])
    })

    afterEach(() => {
        server.events.removeAllListeners('request:start')
        useAccountsStore.getState().setAccounts([])
    })

    it('Given both chains serve history, when the chart is shown, then it plots their sum with its trend', async () => {
        serveHistory({
            algorand: [
                { datetime: '2026-10-20T00:00:00Z', usd_value: '10' },
                { datetime: '2026-10-21T00:00:00Z', usd_value: '12' },
            ],
            ethereum: [
                {
                    timestamp: '2026-10-20T00:00:00Z',
                    wei: '500000000000000000',
                },
                {
                    timestamp: '2026-10-21T00:00:00Z',
                    wei: '600000000000000000',
                },
            ],
        })

        renderHeader(true)

        expect(
            await screen.findByTestId(
                /^trend-indicator-(up|down)$/,
                undefined,
                {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                },
            ),
        ).toBeTruthy()
        expect(requests.algorand).toBeGreaterThan(0)
        expect(requests.ethereum).toBeGreaterThan(0)
        expect(screen.queryByText('common.wealth_chart.empty_body')).toBeNull()
        expect(
            screen.queryByText('common.network_unavailable.title'),
        ).toBeNull()
    })

    it('Given Ethereum serves no balance history, when the chart is shown, then it says the chart is unavailable rather than plotting Algorand alone', async () => {
        serveHistory({
            algorand: [
                { datetime: '2026-10-20T00:00:00Z', usd_value: '10' },
                { datetime: '2026-10-21T00:00:00Z', usd_value: '12' },
            ],
        })

        renderHeader(true)

        expect(
            await screen.findByText(
                'common.network_unavailable.title',
                undefined,
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            ),
        ).toBeTruthy()
        // Asked, and answered "not enabled": not short-circuited before the backend.
        expect(requests.ethereum).toBeGreaterThan(0)
        expect(screen.queryByTestId(/^trend-indicator-/)).toBeNull()
    })

    it('Given neither chain has points yet, when the chart is shown, then it explains that history will appear', async () => {
        serveHistory({ algorand: [], ethereum: [] })

        renderHeader(true)

        expect(
            await screen.findByText(
                'common.wealth_chart.empty_body',
                undefined,
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            ),
        ).toBeTruthy()
        expect(requests.algorand).toBeGreaterThan(0)
        expect(requests.ethereum).toBeGreaterThan(0)
    })

    it('Given the chart is hidden, when the header renders, then no history is fetched', async () => {
        serveHistory({ algorand: [], ethereum: [] })

        renderHeader(false)

        await screen.findByTestId('account_portfolio', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(requests).toEqual({ algorand: 0, ethereum: 0 })
    })
})
