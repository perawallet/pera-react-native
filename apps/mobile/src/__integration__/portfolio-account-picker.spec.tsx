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

// The portfolio picker's card and rows across a joint account, a single-chain
// watch account and an account on two chains. Copy is asserted by key: this
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
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { AccountDrawerContextValue } from '@modules/accounts/components/AccountDrawer/AccountDrawerContext'
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
const { useNetworkStore } = await import('@perawallet/wallet-core-chain-shared')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
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
const { AccountDrawerContext } =
    await import('@modules/accounts/components/AccountDrawer/AccountDrawerContext')
const { AccountMenu } =
    await import('@modules/accounts/components/AccountMenu/AccountMenu')
const { ALGO25_TEST_ADDRESS } = await import('./__fixtures__/onboarding')
const { Decimal } = await import('decimal.js')

const { REVIEW_RECEIVER_ADDRESS, REVIEW_SIGNER_ADDRESS } =
    await import('@test-utils/signing-review')

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const WATCHED_ETH_ADDRESS = '0x000000000000000000000000000000000000dead'
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ALGO_SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const ETH_CAIP19 = 'eip155:1/slip44:60'

const CROSS_CHAIN_ACCOUNT: WalletAccount = {
    id: 'cross-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
        ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' },
    },
    name: 'Everyday',
}

const WATCH_ETH_ACCOUNT: WalletAccount = {
    id: 'watch-eth-1',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: WATCHED_ETH_ADDRESS } },
    name: 'Vitalik',
}

const JOINT_ACCOUNT: WalletAccount = {
    id: 'joint-1',
    custody: { kind: 'multisig' },
    chains: {
        algorand: {
            address: REVIEW_RECEIVER_ADDRESS,
            native: {
                family: 'algorand',
                multisig: {
                    threshold: 2,
                    addresses: [
                        REVIEW_SIGNER_ADDRESS,
                        ALGO25_TEST_ADDRESS,
                        REVIEW_RECEIVER_ADDRESS,
                    ],
                    version: 1,
                },
            },
        },
    },
    name: 'Family',
}

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
    // Seeded so the empty watch account isn't fetched from an RPC the test doesn't serve.
    await upsertAccountChainState({
        accountAddress: WATCHED_ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal(0),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
}

// What Algorand was worth at the start of each window; it is $3 half an hour
// ago in all of them. Ethereum's valued grid is the same whatever the period,
// so the periods differ only in the Algorand figure carried to where both
// chains have a value.
const ALGORAND_START_USD: Record<string, string> = {
    'one-day': '2',
    'one-week': '1',
    'one-month': '0.5',
    'one-year': '0.25',
}

const serveHistory = () =>
    server.use(
        http.get('*/v1/wallet/wealth/', ({ request }) => {
            const period = new URL(request.url).searchParams.get('period')
            return HttpResponse.json({
                results: [
                    {
                        datetime: ago(24 * HOUR),
                        usd_value: ALGORAND_START_USD[period ?? 'one-day'],
                        algo_value: '1',
                        round: 1,
                    },
                    {
                        datetime: ago(HOUR / 2),
                        usd_value: '3',
                        algo_value: '10',
                        round: 2,
                    },
                ],
            })
        }),
        ...peraEvmHandlers({
            balanceHistory: {
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

const onAddAccount = vi.fn()

const renderMenu = (props: { hideDefaultHeader?: boolean } = {}) =>
    renderWithNavigation(
        () => (
            <AccountMenu
                onSelected={() => {}}
                onAddAccount={onAddAccount}
                onOpenSort={() => {}}
                {...props}
            />
        ),
        'AccountMenuHost',
    )

const rowOf = (account: WalletAccount) =>
    screen.getByTestId(
        `account_switcher_row_${Object.values(account.chains)[0]?.address}`,
    )

const changeLine = () => screen.getByTestId('portfolio_change_line')

describe('Flow: Portfolio account picker', () => {
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
        useSettingsStore.getState().setPrivacyMode(false)
        onAddAccount.mockClear()
        await seedBalances()
        useAccountsStore
            .getState()
            .setAccounts([
                JOINT_ACCOUNT,
                WATCH_ETH_ACCOUNT,
                CROSS_CHAIN_ACCOUNT,
            ])
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useSettingsStore.getState().setPrivacyMode(false)
        useNetworkStore.getState().resetState()
    })

    it('Given a joint, a watch and a cross-chain account, when the picker renders, then each row shows one fiat value and no native amount', async () => {
        serveHistory()

        renderMenu()

        await waitFor(() => {
            expect(
                within(rowOf(CROSS_CHAIN_ACCOUNT)).getByText(/3,003\.00/),
            ).toBeTruthy()
        })
        expect(
            within(rowOf(CROSS_CHAIN_ACCOUNT)).queryByText(/1\.5/),
        ).toBeNull()
        expect(
            within(rowOf(CROSS_CHAIN_ACCOUNT)).queryByText(/ALGO|ETH/),
        ).toBeNull()
        expect(
            within(rowOf(WATCH_ETH_ACCOUNT)).queryByText(
                new RegExp(WATCHED_ETH_ADDRESS.slice(0, 6)),
            ),
        ).toBeNull()
    })

    it('Given a joint account of three members, when the picker renders, then its icon carries a badge reading 3', async () => {
        serveHistory()

        renderMenu()

        await waitFor(() => {
            expect(
                within(
                    within(rowOf(JOINT_ACCOUNT)).getByTestId(
                        'account_avatar_badge',
                    ),
                ).getByText('3'),
            ).toBeTruthy()
        })
        expect(
            within(rowOf(CROSS_CHAIN_ACCOUNT)).queryByTestId(
                'account_avatar_badge',
            ),
        ).toBeNull()
    })

    it('Given an Ethereum watch account and an account on two chains, when the picker renders, then only the watch account names its network', async () => {
        serveHistory()

        renderMenu()

        await waitFor(() => {
            expect(
                within(rowOf(WATCH_ETH_ACCOUNT)).getByTestId(
                    'chain_label_ethereum',
                ),
            ).toBeTruthy()
        })
        expect(
            within(rowOf(WATCH_ETH_ACCOUNT)).getByText(
                'account_details.assets.chain_network',
            ),
        ).toBeTruthy()
        expect(
            within(rowOf(CROSS_CHAIN_ACCOUNT)).queryByTestId(/chain_label_/),
        ).toBeNull()
        expect(
            within(rowOf(JOINT_ACCOUNT)).queryByTestId(/chain_label_/),
        ).toBeNull()
    })

    it("Given the chart is collapsed, when the card renders, then it shows the last 24 hours' change, and expanding follows the chart's period", async () => {
        serveHistory()

        renderMenu()

        // $2 + $1,500 a day ago, $3 + $3,000 now.
        await waitFor(
            () => {
                expect(changeLine().textContent).toMatch(/\+\D*1,501\.00/)
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        fireEvent.click(await screen.findByText('portfolio.show_chart'))
        await waitFor(
            () => {
                expect(changeLine().textContent).toMatch(/\+\D*1,502\.00/)
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        fireEvent.click(screen.getByText('chart.one_month.label'))
        await waitFor(
            () => {
                expect(changeLine().textContent).toMatch(/\+\D*1,502\.50/)
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen
                .getAllByText(/portfolio\.(show|hide)_chart/)
                .map(node => node.textContent),
        ).toEqual(['portfolio.hide_chart'])
    })

    it('Given a wallet on Algorand only, when the card renders, then the total leads in fiat like the rows', async () => {
        serveHistory()
        useAccountsStore.getState().setAccounts([
            {
                id: 'algo-only',
                custody: { kind: 'local', seed: null },
                chains: {
                    algorand: {
                        address: ALGO25_TEST_ADDRESS,
                        keyPairId: 'a-key',
                    },
                },
                name: 'Algo only',
            },
        ])

        renderMenu()

        await waitFor(() => {
            expect(
                screen.getByTestId('portfolio_total_value').textContent,
            ).toMatch(/3\.00/)
        })
        expect(
            screen.getByTestId('portfolio_total_value').textContent,
        ).not.toMatch(/ALGO|10/)
    })

    it('Given developer mode puts the wallet on a test network, when the card renders, then it shows the TestNet badge instead of a $0.00 total', async () => {
        serveHistory()
        useNetworkStore.getState().setMode('developer')
        useAccountsStore.getState().setAccounts([CROSS_CHAIN_ACCOUNT])

        renderMenu()

        expect(
            await screen.findByText('common.network_label.testnet'),
        ).toBeTruthy()
        expect(screen.queryByTestId('portfolio_total_value')).toBeNull()
        expect(
            screen.queryByTestId('portfolio_total_partial_notice'),
        ).toBeNull()
        expect(screen.queryByTestId('portfolio_change_line')).toBeNull()
    })

    it('Given the Add Account pill, when it is pressed, then the add-account flow opens', async () => {
        serveHistory()

        renderMenu()
        fireEvent.click(
            await screen.findByTestId('account_menu_add_account_button'),
        )

        expect(onAddAccount).toHaveBeenCalledTimes(1)
    })

    it('Given a picker that only selects an account, when it renders, then there is no Add Account pill', async () => {
        serveHistory()

        renderMenu({ hideDefaultHeader: true })

        await screen.findByTestId(`account_switcher_row_${ALGO25_TEST_ADDRESS}`)
        expect(
            screen.queryByTestId('account_menu_add_account_button'),
        ).toBeNull()
    })

    it('Given the drawer is closed and the chart was left on, when the picker mounts, then no history is requested until it opens', async () => {
        serveHistory()
        useSettingsStore.getState().setPreference('chart-visible', true)
        const requested: string[] = []
        server.events.on('request:start', ({ request }) => {
            requested.push(request.url)
        })
        const isHistory = (url: string) => /wealth|balance-history/.test(url)

        try {
            renderWithNavigation(
                () => (
                    <AccountDrawerContext.Provider
                        value={{ isOpen: false } as AccountDrawerContextValue}
                    >
                        <AccountMenu
                            onSelected={() => {}}
                            onAddAccount={onAddAccount}
                            onOpenSort={() => {}}
                        />
                    </AccountDrawerContext.Provider>
                ),
                'AccountMenuHost',
            )
            await waitFor(() => {
                expect(
                    screen.getByTestId('portfolio_total_value').textContent,
                ).toMatch(/3,003/)
            })
            expect(requested.filter(isHistory)).toEqual([])
        } finally {
            server.events.removeAllListeners()
        }
    })

    it('Given privacy mode, when the picker renders, then the total, the change line and every row balance are hidden', async () => {
        serveHistory()
        useSettingsStore.getState().setPrivacyMode(true)
        const served: string[] = []
        server.events.on('response:mocked', ({ request }) => {
            served.push(request.url)
        })

        renderMenu()

        // The mask only renders once a value is known, so this waits out loading.
        await waitFor(
            () => {
                expect(
                    screen.getByTestId('portfolio_total_value').textContent,
                ).toMatch(/\*{4}/)
                expect(
                    within(rowOf(CROSS_CHAIN_ACCOUNT)).getByText(/\*{4}/),
                ).toBeTruthy()
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        // The line would show once the history it measures has been served.
        try {
            await waitFor(
                () => {
                    expect(served.some(url => /wealth/.test(url))).toBe(true)
                },
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
        } finally {
            server.events.removeAllListeners()
        }
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(screen.queryByTestId('portfolio_change_line')).toBeNull()
        expect(screen.queryByText(/3,003/)).toBeNull()
    })
})
