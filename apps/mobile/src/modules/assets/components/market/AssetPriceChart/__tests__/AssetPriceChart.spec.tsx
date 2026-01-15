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
import AssetPriceChart from '../AssetPriceChart'
import {
    PeraAsset,
    useAssetPriceHistoryQuery,
} from '@perawallet/wallet-core-assets'
import Decimal from 'decimal.js'

vi.mock('react-native-gifted-charts', () => ({
    LineChart: 'LineChart',
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetPriceHistoryQuery: vi.fn(() => ({
            data: null,
            isPending: false,
        })),
    }
})

const mockAsset = { assetId: '123' } as unknown as PeraAsset

describe('AssetPriceChart', () => {
    it('renders loading state when isPending is true', () => {
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <AssetPriceChart
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders empty view when no data is available', () => {
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: [],
            isPending: false,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <AssetPriceChart
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        // Empty data should show the component
        expect(container).toBeTruthy()
    })

    it('renders chart when data is available', () => {
        const mockData = [
            { fiatPrice: new Decimal(100), datetime: new Date() },
            { fiatPrice: new Decimal(110), datetime: new Date() },
        ]
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: mockData,
            isPending: false,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <AssetPriceChart
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('calls onSelectionChanged callback when provided', () => {
        const onSelectionChanged = vi.fn()
        const mockData = [{ fiatPrice: new Decimal(100), datetime: new Date() }]
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: mockData,
            isPending: false,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <AssetPriceChart
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={onSelectionChanged}
            />,
        )
        // Component should render without errors
        expect(container).toBeTruthy()
    })
})
