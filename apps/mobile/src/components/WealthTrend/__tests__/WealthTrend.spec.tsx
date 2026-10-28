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
import { useAccountBalancesHistoryQuery } from '@perawallet/wallet-core-accounts'
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
        useAccountBalancesHistoryQuery: vi.fn(() => ({
            data: null,
            isPending: false,
        })),
        useAllAccounts: vi.fn(() => []),
    }
})

describe('WealthTrend', () => {
    it('renders empty when isPending is true', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(<WealthTrend period='one-week' />)
        expect(container.innerHTML).toBe('')
    })

    it('renders empty on a network with no Pera backend', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                    nativeValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(120),
                    nativeValue: new Decimal(120),
                },
            ],
            isPending: false,
            isUnavailableOnNetwork: true,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(<WealthTrend period='one-week' />)

        expect(container.innerHTML).toBe('')
    })

    it('displays positive trend with percentage', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                    nativeValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(120),
                    nativeValue: new Decimal(120),
                },
            ],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(<WealthTrend period='one-week' />)
        expect(container.textContent).toContain('%')
    })

    it('displays negative trend with percentage', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(100),
                    nativeValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(80),
                    nativeValue: new Decimal(80),
                },
            ],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container, getByTestId } = render(
            <WealthTrend period='one-week' />,
        )
        // Direction is shown by the down arrow; the percentage is absolute.
        expect(getByTestId('trend-indicator-down')).toBeTruthy()
        expect(container.textContent).toContain('%')
    })

    it('computes the trend from fiat value, not ALGO-denominated value', () => {
        // All-ALGO account during a price rally: the ALGO-denominated value
        // stays flat while the fiat value climbs 8% — the badge must follow fiat.
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [
                {
                    preferredValue: new Decimal(50),
                    nativeValue: new Decimal(100),
                },
                {
                    preferredValue: new Decimal(54),
                    nativeValue: new Decimal(100),
                },
            ],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container, getByTestId } = render(
            <WealthTrend period='one-day' />,
        )

        expect(container.textContent).toContain('8.00%')
        expect(getByTestId('trend-indicator-up')).toBeTruthy()
    })

    it('reads the history of the given account only', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        render(
            <WealthTrend
                account={{
                    id: 'test',
                    custody: { kind: 'watch' },
                    chains: { algorand: { address: 'test-address' } },
                }}
                period='one-week'
            />,
        )

        expect(
            vi.mocked(useAccountBalancesHistoryQuery),
        ).toHaveBeenLastCalledWith(
            ['test-address'],
            'one-week',
            expect.objectContaining({ chainId: 'algorand' }),
            true,
        )
    })
})
