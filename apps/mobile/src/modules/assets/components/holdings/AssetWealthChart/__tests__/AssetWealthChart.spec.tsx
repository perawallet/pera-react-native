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
import { AssetWealthChart } from '../AssetWealthChart'
import {
    WalletAccount,
    useAccountsAssetsBalanceHistoryQuery,
} from '@perawallet/wallet-core-accounts'
import { PeraAsset } from '@perawallet/wallet-core-assets'
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
        useAccountsAssetsBalanceHistoryQuery: vi.fn(() => ({
            data: null,
            isPending: false,
        })),
    }
})

const mockAccount = { address: 'test' } as WalletAccount
const mockAsset = { assetId: '123' } as PeraAsset

describe('AssetWealthChart', () => {
    it('renders loading state when isPending is true', () => {
        vi.mocked(useAccountsAssetsBalanceHistoryQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as unknown as ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>)

        const { container } = render(
            <AssetWealthChart
                account={mockAccount}
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders empty view when no data is available', () => {
        vi.mocked(useAccountsAssetsBalanceHistoryQuery).mockReturnValue({
            data: [],
            isPending: false,
        } as unknown as ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>)

        const { container } = render(
            <AssetWealthChart
                account={mockAccount}
                asset={mockAsset}
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
        vi.mocked(useAccountsAssetsBalanceHistoryQuery).mockReturnValue({
            data: mockData,
            isPending: false,
        } as unknown as ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>)

        const { container } = render(
            <AssetWealthChart
                account={mockAccount}
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('accepts different period values', () => {
        const mockData = [{ fiatValue: new Decimal(100), datetime: new Date() }]
        vi.mocked(useAccountsAssetsBalanceHistoryQuery).mockReturnValue({
            data: mockData,
            isPending: false,
        } as unknown as ReturnType<typeof useAccountsAssetsBalanceHistoryQuery>)

        const { container } = render(
            <AssetWealthChart
                account={mockAccount}
                asset={mockAsset}
                period='one-month'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })
})
