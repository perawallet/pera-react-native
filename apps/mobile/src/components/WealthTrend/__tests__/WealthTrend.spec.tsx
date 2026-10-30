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

import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WealthTrend } from '../WealthTrend'
import {
    useAccountsAssetsBalanceHistoryQuery,
    usePortfolioHistoryQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSettings } from '@perawallet/wallet-core-settings'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { Decimal } from 'decimal.js'

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(() => ({
        privacyMode: false,
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: vi.fn((amount: Decimal) => amount),
        nativeUsdPrice: new Decimal(0),
    })),
    usePreferredCurrencyPriceQuery: vi.fn(() => ({
        data: null,
        isPending: false,
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        usePortfolioHistoryQuery: vi.fn(),
        useAccountsAssetsBalanceHistoryQuery: vi.fn(),
    }
})

const ALGORAND: ChainScope = {
    chainId: 'algorand' as ChainId,
    networkId: 'mainnet',
}
const SOURCES = [{ address: 'ALGO', scope: ALGORAND }]
const HOLDING = {
    account: { id: 'account-1' } as WalletAccount,
    assetId: '31566704',
    scope: ALGORAND,
}

const mockHistory = (
    values: number[],
    overrides: Record<string, unknown> = {},
) =>
    vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
        data: values.map(value => ({
            datetime: new Date(0),
            preferredValue: new Decimal(value),
        })),
        isPending: false,
        isPaused: false,
        isPartial: false,
        ...overrides,
    } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

const mockHoldingHistory = (
    values: (number | null)[],
    overrides: Record<string, unknown> = {},
) =>
    vi.mocked(useAccountsAssetsBalanceHistoryQuery).mockReturnValue({
        data: values.map(value => ({
            datetime: new Date(0),
            preferredValue: value === null ? null : new Decimal(value),
        })),
        isPending: false,
        isPaused: false,
        isUnavailableOnNetwork: false,
        ...overrides,
    } as unknown as ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>)

const renderTrend = (period: 'one-day' | 'one-week' = 'one-day') =>
    render(
        <WealthTrend
            sources={SOURCES}
            currencyScope={ALGORAND}
            period={period}
        />,
    )

describe('WealthTrend', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
        } as unknown as ReturnType<typeof useSettings>)
        mockHoldingHistory([])
    })

    it('shows a gain with a plus sign on the amount and the percentage', () => {
        mockHistory([100, 120])

        const { getByTestId } = renderTrend()

        expect(getByTestId('wealth_trend').textContent).toMatch(
            /^\+.*20 \(\+20\.00%\)$/,
        )
    })

    it('shows a loss with a minus sign on the amount and the percentage', () => {
        mockHistory([100, 80])

        const { getByTestId } = renderTrend()

        expect(getByTestId('wealth_trend').textContent).toMatch(
            /^-.*20 \(-20\.00%\)$/,
        )
    })

    it('shows no sign when the value is unchanged', () => {
        mockHistory([100, 100])

        const { getByTestId } = renderTrend()

        const text = getByTestId('wealth_trend').textContent
        expect(text).toContain('(0.00%)')
        expect(text).not.toMatch(/[+-]/)
    })

    it('rounds a change just under a cent the way its direction does, never as "< $0.01"', () => {
        mockHistory([100, 100.007])

        const { getByTestId } = renderTrend()

        const text = getByTestId('wealth_trend').textContent
        expect(text).toContain('+')
        expect(text).toContain('0.01')
        expect(text).not.toContain('<')
    })

    it('leaves the percentage out when the account had no value at the start', () => {
        mockHistory([0, 100])

        const { getByTestId } = renderTrend()

        const text = getByTestId('wealth_trend').textContent
        expect(text).toMatch(/^\+.*100$/)
        expect(text).not.toContain('%')
    })

    it('reads a flat move as 0.00% however small the balance', () => {
        mockHistory([10, 10.004])

        const { getByTestId } = renderTrend()

        expect(getByTestId('wealth_trend').textContent).toMatch(
            /^[^+-]*0 \(0\.00%\)$/,
        )
    })

    it('shows a placeholder while the history loads', () => {
        mockHistory([], { isPending: true })

        const { getByTestId, queryByTestId } = renderTrend()

        expect(getByTestId('wealth_trend_loading')).toBeTruthy()
        expect(queryByTestId('wealth_trend')).toBeNull()
    })

    it('shows nothing in privacy mode', () => {
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: true,
        } as unknown as ReturnType<typeof useSettings>)
        mockHistory([100, 120])

        const { container } = renderTrend()

        expect(container.innerHTML).toBe('')
    })

    it('shows nothing when there is no history to measure', () => {
        mockHistory([])

        const { container } = renderTrend()

        expect(container.innerHTML).toBe('')
    })

    it('shows nothing on a network with no Pera backend', () => {
        // The query drops its points when a source's chain has no history.
        mockHistory([], { isUnavailableOnNetwork: true })

        const { container } = renderTrend()

        expect(container.innerHTML).toBe('')
    })

    it('shows nothing while the chart leaves a network out of the total', () => {
        mockHistory([100, 120], { isPartial: true })

        const { container } = renderTrend()

        expect(container.innerHTML).toBe('')
    })

    it('always fetches the history of exactly the sources it is given', () => {
        mockHistory([])

        renderTrend('one-week')

        expect(vi.mocked(usePortfolioHistoryQuery)).toHaveBeenLastCalledWith(
            SOURCES,
            'one-week',
            ALGORAND,
            true,
        )
    })

    describe('for one holding', () => {
        const renderHoldingTrend = () =>
            render(
                <WealthTrend
                    holding={HOLDING}
                    period='one-month'
                />,
            )

        beforeEach(() => {
            mockHistory([])
        })

        it('trends the holding history and leaves the portfolio query off', () => {
            mockHoldingHistory([200, 250])

            const { getByTestId } = renderHoldingTrend()

            expect(getByTestId('wealth_trend').textContent).toContain(
                '(+25.00%)',
            )
            expect(
                vi.mocked(useAccountsAssetsBalanceHistoryQuery),
            ).toHaveBeenLastCalledWith(
                HOLDING.account,
                HOLDING.assetId,
                'one-month',
                ALGORAND,
                true,
            )
            expect(
                vi.mocked(usePortfolioHistoryQuery),
            ).toHaveBeenLastCalledWith([], 'one-month', ALGORAND, false)
        })

        it('shows nothing when every point is unpriced', () => {
            mockHoldingHistory([null, null])

            const { container } = renderHoldingTrend()

            expect(container.innerHTML).toBe('')
        })

        it('shows nothing on a chain with no balance history', () => {
            mockHoldingHistory([200, 250], { isUnavailableOnNetwork: true })

            const { container } = renderHoldingTrend()

            expect(container.innerHTML).toBe('')
        })
    })
})
