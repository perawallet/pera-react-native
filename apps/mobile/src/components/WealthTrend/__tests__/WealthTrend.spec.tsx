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
import { describe, it, expect, vi } from 'vitest'
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
        usePortfolioHistoryQuery: vi.fn(() => ({
            data: [],
            isPending: false,
            isPartial: false,
        })),
        useAccountsAssetsBalanceHistoryQuery: vi.fn(() => ({
            data: [],
            isPending: false,
            isUnavailableOnNetwork: false,
        })),
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

const holdingHistory = (
    overrides: Partial<ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>>,
) =>
    vi.mocked(useAccountsAssetsBalanceHistoryQuery).mockReturnValue({
        data: [],
        isPending: false,
        isUnavailableOnNetwork: false,
        ...overrides,
    } as ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>)

describe('WealthTrend', () => {
    it('renders empty when isPending is true', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [],
            isPending: true,
            isPartial: false,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-week'
            />,
        )
        expect(container.innerHTML).toBe('')
    })

    it('renders empty on a network with no Pera backend', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(120),
                },
            ],
            isPending: false,
            isPartial: false,
            isUnavailableOnNetwork: true,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-week'
            />,
        )

        expect(container.innerHTML).toBe('')
    })

    it('renders empty when there is no history to measure', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [],
            isPending: false,
            isPartial: false,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-week'
            />,
        )

        expect(container.innerHTML).toBe('')
    })

    it('displays positive trend with percentage', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(120),
                },
            ],
            isPending: false,
            isPartial: false,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-week'
            />,
        )
        expect(container.textContent).toContain('%')
    })

    it('renders empty while the chart leaves a network out of the total', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(120),
                },
            ],
            isPending: false,
            isPartial: true,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-week'
            />,
        )

        expect(container.innerHTML).toBe('')
    })

    it('displays negative trend with percentage', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(80),
                },
            ],
            isPending: false,
            isPartial: false,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container, getByTestId } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-week'
            />,
        )
        // Direction is shown by the down arrow; the percentage is absolute.
        expect(getByTestId('trend-indicator-down')).toBeTruthy()
        expect(container.textContent).toContain('%')
    })

    it('computes the trend from fiat value, not ALGO-denominated value', () => {
        // All-ALGO account during a price rally: the ALGO-denominated value
        // stays flat while the fiat value climbs 8% — the badge must follow fiat.
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(50),
                },
                {
                    preferredValue: new Decimal(54),
                },
            ],
            isPending: false,
            isPartial: false,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        const { container, getByTestId } = render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-day'
            />,
        )

        expect(container.textContent).toContain('8.00%')
        expect(getByTestId('trend-indicator-up')).toBeTruthy()
    })

    it('reads the history of exactly the sources it is given', () => {
        vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
            data: [],
            isPending: false,
            isPartial: false,
        } as unknown as ReturnType<typeof usePortfolioHistoryQuery>)

        render(
            <WealthTrend
                sources={SOURCES}
                currencyScope={ALGORAND}
                period='one-month'
                enabled={false}
            />,
        )

        expect(vi.mocked(usePortfolioHistoryQuery)).toHaveBeenLastCalledWith(
            SOURCES,
            'one-month',
            ALGORAND,
            false,
        )
    })
    describe('for one holding', () => {
        it('trends the holding history and leaves the portfolio query off', () => {
            holdingHistory({
                data: [
                    { preferredValue: new Decimal(200) },
                    { preferredValue: new Decimal(250) },
                ] as never,
            })

            const { getByTestId } = render(
                <WealthTrend
                    holding={HOLDING}
                    period='one-month'
                />,
            )

            expect(getByTestId('wealth_trend').textContent).toContain('25.00%')
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

        it('renders empty when every point is unpriced', () => {
            holdingHistory({
                data: [
                    { preferredValue: null },
                    { preferredValue: null },
                ] as never,
            })

            const { container } = render(
                <WealthTrend
                    holding={HOLDING}
                    period='one-week'
                />,
            )

            expect(container.innerHTML).toBe('')
        })

        it('renders empty on a chain with no balance history', () => {
            holdingHistory({
                data: [
                    { preferredValue: new Decimal(200) },
                    { preferredValue: new Decimal(250) },
                ] as never,
                isUnavailableOnNetwork: true,
            })

            const { container } = render(
                <WealthTrend
                    holding={HOLDING}
                    period='one-week'
                />,
            )

            expect(container.innerHTML).toBe('')
        })

        it('renders empty in privacy mode', () => {
            vi.mocked(useSettings).mockReturnValueOnce({
                privacyMode: true,
            } as ReturnType<typeof useSettings>)
            holdingHistory({
                data: [
                    { preferredValue: new Decimal(200) },
                    { preferredValue: new Decimal(250) },
                ] as never,
            })

            const { container } = render(
                <WealthTrend
                    holding={HOLDING}
                    period='one-week'
                />,
            )

            expect(container.innerHTML).toBe('')
        })
    })
})
