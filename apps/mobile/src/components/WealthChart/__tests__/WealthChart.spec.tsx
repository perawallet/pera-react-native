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

import { render, screen } from '@test-utils/render'
import { beforeEach, describe, it, expect, vi } from 'vitest'
// Ensure i18n is initialised so t() resolves real strings in this test's module graph.
import '../../../i18n'
import { WealthChart } from '../WealthChart'
import { usePortfolioHistoryQuery } from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        usePortfolioHistoryQuery: vi.fn(),
    }
})

const ALGORAND: ChainScope = {
    chainId: 'algorand' as ChainId,
    networkId: 'mainnet',
}
const ETHEREUM: ChainScope = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
}
const SOURCES = [
    { address: 'ALGO', scope: ALGORAND },
    { address: '0xeth', scope: ETHEREUM },
]

const mockHistory = (
    overrides: Partial<ReturnType<typeof usePortfolioHistoryQuery>>,
) =>
    vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
        isPaused: false,
        error: null,
        isUnavailableOnNetwork: false,
        excludedChainIds: [],
        isPartial: false,
        refetch: vi.fn(),
        ...overrides,
    })

const renderChart = (enabled?: boolean) =>
    render(
        <WealthChart
            sources={SOURCES}
            currencyScope={ALGORAND}
            period='one-week'
            onSelectionChanged={vi.fn()}
            enabled={enabled}
        />,
    )

describe('WealthChart', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads the summed history of exactly the sources it is given', () => {
        mockHistory({})

        renderChart(false)

        expect(vi.mocked(usePortfolioHistoryQuery)).toHaveBeenLastCalledWith(
            SOURCES,
            'one-week',
            ALGORAND,
            false,
        )
    })

    it('shows the empty state when there is no history', () => {
        mockHistory({})

        renderChart()

        expect(
            screen.getByText(
                'You will see a chart here once you have some balance history',
            ),
        ).toBeTruthy()
    })

    it('renders the offline state instead of the spinner when the history query is paused', () => {
        mockHistory({ isPending: true, isPaused: true })

        renderChart()

        expect(screen.getByText('Offline Mode')).toBeTruthy()
    })

    it('renders the network-unavailable state when a source has no history on its network', () => {
        mockHistory({ isUnavailableOnNetwork: true })

        renderChart()

        expect(screen.getByText('Not available on this network')).toBeTruthy()
    })

    it('names the networks the chart leaves out', () => {
        mockHistory({ excludedChainIds: [ETHEREUM.chainId], isPartial: true })

        renderChart()

        expect(
            screen.getByText(/This chart doesn't include \w+ assets yet/),
        ).toBeTruthy()
    })

    it('joins several left-out networks with a translated conjunction', () => {
        mockHistory({
            excludedChainIds: [ETHEREUM.chainId, 'base' as ChainId],
            isPartial: true,
        })

        renderChart()

        expect(
            screen.getByText(
                /This chart doesn't include \w+ and \w+ assets yet/,
            ),
        ).toBeTruthy()
    })

    it('shows no note when every network is charted', () => {
        mockHistory({})

        renderChart()

        expect(screen.queryByText(/doesn't include/)).toBeNull()
    })
})
