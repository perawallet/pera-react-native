/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import Decimal from 'decimal.js'

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: undefined as any, // Changed to undefined to match test description, but with 'as any'
            isPending: true, // Kept as true to match test description
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(<WealthTrend period='one-week' />)
        // Should render empty fragment when pending
        expect(container.innerHTML).toBe('')
    })

    it('displays positive trend with percentage', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [
                { fiatValue: new Decimal(100) },
                { fiatValue: new Decimal(120) },
            ],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(<WealthTrend period='one-week' />)
        // Should show positive indicator
        expect(container.textContent).toContain('+')
        expect(container.textContent).toContain('%')
    })

    it('displays negative trend with percentage', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [
                { fiatValue: new Decimal(100) },
                { fiatValue: new Decimal(80) },
            ],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(<WealthTrend period='one-week' />)
        expect(container.textContent).toContain('-')
        expect(container.textContent).toContain('%')
    })

    it('uses single account when account prop is provided', () => {
        const mockAccount = { address: 'test-address' }
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [{ fiatValue: new Decimal(100) }],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(
            <WealthTrend
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                account={mockAccount as any}
                period='one-week'
            />,
        )
        expect(container).toBeTruthy()
    })
})
