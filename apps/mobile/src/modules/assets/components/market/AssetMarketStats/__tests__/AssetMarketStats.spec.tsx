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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import AssetMarketStats from '../AssetMarketStats'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import Decimal from 'decimal.js'

const mockUseAssetFiatPricesQuery = vi.fn()
vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual = await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetFiatPricesQuery: () => mockUseAssetFiatPricesQuery(),
    }
})

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ preferredCurrency: { symbol: '$', code: 'USD' } }),
}))

vi.mock('@perawallet/wallet-core-shared', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatWithUnits: (val: unknown) => ({ amount: (val as Decimal).toNumber(), unit: '' }),
        formatNumber: (val: number) => ({ integer: val.toLocaleString(), fraction: '.00' }),
    }
})
vi.mock('@components/CurrencyDisplay', () => ({
    __esModule: true,
    default: () => <div>CurrencyDisplay</div>,
}))
vi.mock('@components/InfoButton', () => ({
    __esModule: true,
    default: () => <div>InfoButton</div>,
}))
const mockDetails = {
    assetId: 123,
    totalSupply: '10000000000',
    decimals: 6,
} as unknown as PeraAsset

describe('AssetMarketStats', () => {
    it('renders stats correctly', () => {
        mockUseAssetFiatPricesQuery.mockReturnValue({
            data: new Map([[123, { fiatPrice: 1.5 }]]),
        })

        render(<AssetMarketStats assetDetails={mockDetails} />)
        
        expect(screen.getByText('asset_details.markets.stats')).toBeTruthy()
        expect(screen.getByText('asset_details.markets.price')).toBeTruthy()
        expect(screen.getByText('CurrencyDisplay')).toBeTruthy()
        expect(screen.getByText('asset_details.markets.total_supply')).toBeTruthy()
        
        // Supply calculation: 10000000000 / 10^6 = 10000 -> 10,000.00
        expect(screen.getByText('10,000.00')).toBeTruthy()
    })

    it('handles missing price', () => {
        mockUseAssetFiatPricesQuery.mockReturnValue({ data: undefined })

        render(<AssetMarketStats assetDetails={mockDetails} />)
        
        // Should still render structure
        expect(screen.getByText('asset_details.markets.stats')).toBeTruthy()
    })
})
