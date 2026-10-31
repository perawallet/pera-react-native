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
import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useRoute } from '@react-navigation/native'

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AssetDetailsScreen } from '@modules/assets/screens/AssetDetailsScreen'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { USDC_TEST_ASSET } from './__fixtures__/assets'
import {
    ETH_USDC,
    LOOKALIKE,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const RPC_URL = 'https://mainnet.rpc.test/'

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
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

// The holding is 2.5 units at $1, so the history ends at $2.50 for every
// period and starts where the period's change should come from.
const HISTORY_START_BY_PERIOD: Record<string, string> = {
    'one-day': '2.40',
    'one-week': '2.00',
    'one-month': '1.00',
    'one-year': '0.50',
}

const serveAlgorandHistory = () =>
    server.use(
        http.get(
            `*/v1/accounts/${ALGO25_TEST_ADDRESS}/assets/${USDC_TEST_ASSET.assetId}/balance-history/`,
            ({ request }) => {
                const period = new URL(request.url).searchParams.get('period')
                const start = HISTORY_START_BY_PERIOD[period ?? 'one-week']
                return HttpResponse.json({
                    results: [
                        {
                            datetime: '2026-10-01T00:00:00Z',
                            amount: '2.5',
                            usd_value: start,
                            round: 1,
                        },
                        {
                            datetime: '2026-10-29T00:00:00Z',
                            amount: '2.5',
                            usd_value: '2.50',
                            round: 2,
                        },
                    ],
                })
            },
        ),
    )

const TabBarStub = () => {
    const route = useRoute() as unknown as { params: { screen: string } }
    return <span data-testid='tab_bar_stub'>{route.params.screen}</span>
}

const selectAccount = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const renderDetails = (params: { assetId: string; chainId: string }) =>
    renderWithNavigation(AssetDetailsScreen, 'AssetDetails', {
        initialParams: params,
        additionalScreens: [{ name: 'TabBar', component: TabBarStub }],
    })

const trend = async () =>
    (await screen.findByTestId('wealth_trend')).textContent ?? ''

describe('Flow: Asset details header leads with the fiat value', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useSettingsStore.getState().resetState()
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        await seedHoldings()
        serveAlgorandHistory()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an Algorand asset, when it opens, then the fiat value leads, the token amount follows, and the change follows the chart period', async () => {
        selectAccount(ALGORAND_ACCOUNT)

        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        expect(
            (await screen.findByTestId('asset_holdings_fiat_value'))
                .textContent,
        ).toContain('2.50')
        const token = screen.getByTestId('asset_holdings_token_amount')
        expect(token.textContent).toContain('2.5')
        expect(token.textContent).toContain('tUSD')
        expect(await trend()).toContain('25.00%')

        fireEvent.click(screen.getAllByText('chart.one_month.label')[0])

        await vi.waitFor(async () => expect(await trend()).toContain('150.00%'))
    })

    it('Given the global chart preference is off, when an Algorand asset opens, then the period selector is on screen and selecting a period updates the change', async () => {
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.chartVisible, false)
        selectAccount(ALGORAND_ACCOUNT)

        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        expect(await trend()).toContain('25.00%')
        expect(screen.getAllByText('chart.one_week.label')[0]).toBeTruthy()

        fireEvent.click(screen.getAllByText('chart.one_day.label')[0])

        await vi.waitFor(async () => expect(await trend()).toContain('4.17%'))
    })

    it('Given an Algorand asset, when Buy/Sell is pressed, then the existing buy flow opens', async () => {
        selectAccount(ALGORAND_ACCOUNT)
        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        const button = await screen.findByTestId('asset_detail_buy_button')
        expect(
            screen.getByText('asset_details.action_buttons.buy_sell'),
        ).toBeTruthy()

        fireEvent.click(button)

        expect((await screen.findByTestId('tab_bar_stub')).textContent).toBe(
            'Fund',
        )
    })

    it('Given an Ethereum token, when it opens, then the fiat value leads and the token amount follows', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)

        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        expect(
            (await screen.findByTestId('asset_holdings_fiat_value'))
                .textContent,
        ).toContain('1.50')
        const token = screen.getByTestId('asset_holdings_token_amount')
        expect(token.textContent).toContain('1.5')
        expect(token.textContent).toContain('USDC')
    })

    it('Given a token with no price, when it opens, then the token amount leads with no fiat value or change line', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)

        renderDetails({ assetId: LOOKALIKE, chainId: 'ethereum' })

        const header = await screen.findByTestId('asset_holdings_header')
        await vi.waitFor(() => {
            expect(
                within(header).queryByTestId('asset_holdings_fiat_value'),
            ).toBeNull()
            expect(
                within(header).getByTestId('asset_holdings_token_amount')
                    .textContent,
            ).toContain('7')
        })
        expect(within(header).queryByTestId('wealth_trend')).toBeNull()
        expect(within(header).queryByText('---')).toBeNull()
    })

    it('Given privacy mode, when an Algorand asset opens, then the value, token amount and change are hidden', async () => {
        useSettingsStore.getState().setPrivacyMode(true)
        selectAccount(ALGORAND_ACCOUNT)

        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        const fiat = await screen.findByTestId('asset_holdings_fiat_value')
        expect(fiat.textContent).toContain('****')
        expect(
            screen.getByTestId('asset_holdings_token_amount').textContent,
        ).toContain('****')
        expect(screen.queryByTestId('wealth_trend')).toBeNull()
    })
})
