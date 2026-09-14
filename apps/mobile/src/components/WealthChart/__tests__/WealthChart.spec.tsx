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
import { describe, it, expect, vi } from 'vitest'
// Ensure i18n is initialised so t() resolves real strings in this test's module graph.
import '../../../i18n'
import { WealthChart } from '../WealthChart'
import {
    useAccountBalancesHistoryQuery,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { Decimal } from 'decimal.js'

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
            data: [],
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
            { preferredValue: new Decimal(100), datetime: new Date() },
            { preferredValue: new Decimal(110), datetime: new Date() },
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
        const mockData = [
            { preferredValue: new Decimal(100), datetime: new Date() },
        ]

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
            data: [{ preferredValue: new Decimal(200), datetime: new Date() }],
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

    it('renders the offline state instead of the spinner when the history query is paused', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [],
            isPending: true,
            isError: false,
            isPaused: true,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        render(
            <WealthChart
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )

        expect(screen.getByText('Offline Mode')).toBeTruthy()
    })

    it('renders the network-unavailable state instead of the spinner on a network with no Pera backend', () => {
        vi.mocked(useAccountBalancesHistoryQuery).mockReturnValue({
            data: [],
            isPending: true,
            isError: false,
            isPaused: false,
            refetch: vi.fn(),
            isUnavailableOnNetwork: true,
        } as unknown as ReturnType<typeof useAccountBalancesHistoryQuery>)

        render(
            <WealthChart
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )

        expect(screen.getByText('Not available on this network')).toBeTruthy()
    })
})
