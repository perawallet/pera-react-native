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

// A token the price source has no price for is a normal state, so its details
// show no chart error however the chart endpoint answers; a priced token whose
// chart request fails keeps its error and Retry.

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
import { http, HttpResponse } from 'msw'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // The chain context reads its services here, not from `hasPeraService`.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? new Set(['prices', 'history'] as const)
                : withBackend.peraServicesFor(scope),
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { screen } = await import('@testing-library/react')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { recordPriceMisses } = await import('@perawallet/wallet-core-assets')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AssetDetailsScreen } =
    await import('@modules/assets/screens/AssetDetailsScreen')
const { useBottomSheetStore } = await import('@modules/bottom-sheet')
const { ETH_SCOPE, ETH_USDC, LOOKALIKE, seedHoldings, TWO_CHAIN_ACCOUNT } =
    await import('./__fixtures__/multichainHoldings')

const failChart = () =>
    server.use(
        http.get('*/api/v4/assets/chart/', () =>
            HttpResponse.json(
                { error: 'Upstream unavailable', code: 'upstream_unavailable' },
                { status: 503 },
            ),
        ),
    )

const renderDetails = (assetId: string) => {
    useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
    useAccountsStore.getState().setSelectedAccountId(TWO_CHAIN_ACCOUNT.id)
    return renderWithNavigation(AssetDetailsScreen, 'AssetDetails', {
        initialParams: { assetId, chainId: 'ethereum' },
    })
}

describe('Flow: Asset details for a token with no market data', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        await seedHoldings()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an Ethereum token the price source has no price for, when its details open, then neither tab shows a chart, a period selector, a trend, an error or Retry, and Markets says it has no market data', async () => {
        await recordPriceMisses({ assetIds: [LOOKALIKE], scope: ETH_SCOPE })
        failChart()

        renderDetails(LOOKALIKE)

        expect(
            await screen.findByTestId(
                'asset_markets_no_market_data',
                undefined,
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            ),
        ).toBeTruthy()
        expect(screen.queryAllByText('chart.one_week.label')).toHaveLength(0)
        expect(screen.queryAllByTestId('balance-chart-retry')).toHaveLength(0)
        expect(screen.queryAllByText('common.error.title')).toHaveLength(0)
        expect(
            screen.queryAllByTestId('asset_markets_price_trend'),
        ).toHaveLength(0)
    })

    it('Given a priced Ethereum token, when its chart request fails, then the chart shows the error and Retry', async () => {
        failChart()

        renderDetails(ETH_USDC)

        expect(
            await screen.findByText(
                'asset_details.markets.something_went_wrong_body',
                undefined,
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            ),
        ).toBeTruthy()
        expect(
            screen.getAllByTestId('balance-chart-retry').length,
        ).toBeGreaterThan(0)
    })
})
