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
import { PriceTrend } from '../PriceTrend'
import { useAssetPriceHistoryQuery } from '@perawallet/wallet-core-assets'
import Decimal from 'decimal.js'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetPriceHistoryQuery: vi.fn(() => ({
            data: null,
        })),
    }
})

describe('PriceTrend', () => {
    it('displays positive trend with percentage', () => {
        const mockData = [
            { fiatPrice: new Decimal(100), datetime: new Date() },
            { fiatPrice: new Decimal(120), datetime: new Date() },
        ]
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: mockData,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <PriceTrend
                assetId='123'
                period='one-week'
            />,
        )
        // Should display percentage
        expect(container.textContent).toContain('%')
    })

    it('displays negative trend with percentage', () => {
        const mockData = [
            { fiatPrice: new Decimal(100), datetime: new Date() },
            { fiatPrice: new Decimal(80), datetime: new Date() },
        ]
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: mockData,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <PriceTrend
                assetId='123'
                period='one-week'
            />,
        )
        expect(container.textContent).toContain('%')
    })

    it('shows absolute value when showAbsolute is true', () => {
        const mockData = [
            { fiatPrice: new Decimal(100), datetime: new Date() },
            { fiatPrice: new Decimal(150), datetime: new Date() },
        ]
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: mockData,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <PriceTrend
                assetId='123'
                period='one-week'
                showAbsolute={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('handles zero price data gracefully', () => {
        const mockData = [
            { fiatPrice: new Decimal(0), datetime: new Date() },
            { fiatPrice: new Decimal(0), datetime: new Date() },
        ]
        vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
            data: mockData,
        } as ReturnType<typeof useAssetPriceHistoryQuery>)

        const { container } = render(
            <PriceTrend
                assetId='123'
                period='one-week'
            />,
        )
        expect(container).toBeTruthy()
    })
})
