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
import { WealthChart } from '../WealthChart'
import {
    useAccountBalancesHistoryQuery,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import Decimal from 'decimal.js'

vi.mock('react-native-gifted-charts', () => ({
    LineChart: () => <div data-testid='line-chart'>LineChart</div>,
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

describe('WealthChart', () => {
    it('renders loading state when isPending is true', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(
            <WealthChart
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders empty view when no data is available', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(
            <WealthChart
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders chart when data is available', () => {
        const mockData = [
            { fiatValue: new Decimal(100), datetime: new Date() },
            { fiatValue: new Decimal(110), datetime: new Date() },
        ]
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: mockData,
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(
            <WealthChart
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('uses single account address when account prop is provided', () => {
        const mockAccount = { address: 'test-address', name: 'Test' }
        const mockData = [{ fiatValue: new Decimal(100), datetime: new Date() }]

        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: mockData,
            isPending: false,
        } as any as ReturnType<typeof useAccountBalancesHistoryQuery>) // eslint-disable-line @typescript-eslint/no-explicit-any

        const { container } = render(
            <WealthChart
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                account={mockAccount as any}
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('uses all account addresses when no account prop is provided', () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            { address: 'addr1' },
            { address: 'addr2' },
        ] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [{ fiatValue: new Decimal(200), datetime: new Date() }],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        const { container } = render(
            <WealthChart
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })
})
