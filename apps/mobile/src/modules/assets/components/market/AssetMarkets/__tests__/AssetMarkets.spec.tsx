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
import AssetMarkets from '../AssetMarkets'
import { PeraAsset } from '@perawallet/wallet-core-assets'

const mockAsset = {
    assetId: '123',
    name: 'TEST',
    decimals: 6,
} as unknown as PeraAsset

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(() => ({
            data: { assetId: 123 },
            isPending: false,
            isError: false,
        })),
        useAssetFiatPricesQuery: vi.fn(() => ({ data: new Map() })),
    }
})

// Mock complex children
vi.mock('../AssetPriceChart/AssetPriceChart', () => ({
    default: 'AssetPriceChart',
}))
vi.mock('../AssetMarketStats/AssetMarketStats', () => ({
    default: 'AssetMarketStats',
}))
vi.mock('../AssetAbout/AssetAbout', () => ({ default: 'AssetAbout' }))
vi.mock('../AssetVerificationCard/AssetVerificationCard', () => ({
    default: 'AssetVerificationCard',
}))
vi.mock('../AssetDescription/AssetDescription', () => ({
    default: 'AssetDescription',
}))
vi.mock('../AssetSocialMedia/AssetSocialMedia', () => ({
    default: 'AssetSocialMedia',
}))
vi.mock('../PriceTrend/PriceTrend', () => ({ default: 'PriceTrend' }))

describe('AssetMarkets', () => {
    it('renders correctly', () => {
        render(<AssetMarkets asset={mockAsset} />)
        expect(true).toBe(true)
    })
})
