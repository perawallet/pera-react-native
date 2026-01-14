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

vi.mock('../AssetPriceChart/AssetPriceChart', () => ({
    default: () => <div>AssetPriceChart</div>,
}))
vi.mock('../AssetMarketStats/AssetMarketStats', () => ({
    default: () => <div>AssetMarketStats</div>,
}))
vi.mock('../AssetAbout/AssetAbout', () => ({ default: () => <div>AssetAbout</div> }))
vi.mock('../AssetVerificationCard/AssetVerificationCard', () => ({
    default: () => <div>AssetVerificationCard</div>,
}))
vi.mock('../AssetDescription/AssetDescription', () => ({
    default: () => <div>AssetDescription</div>,
}))
vi.mock('../AssetSocialMedia/AssetSocialMedia', () => ({
    default: () => <div>AssetSocialMedia</div>,
}))
vi.mock('../PriceTrend/PriceTrend', () => ({ default: () => <div>PriceTrend</div> }))

describe('AssetMarkets', () => {
    it('renders all sections correctly', () => {
        render(<AssetMarkets asset={mockAsset} />)
        
        // Check for presence of mocked children as text since they return strings in mocks
        expect(screen.getByText('AssetPriceChart')).toBeTruthy()
        expect(screen.getByText('AssetMarketStats')).toBeTruthy()
        expect(screen.getByText('AssetAbout')).toBeTruthy()
        expect(screen.getByText('AssetVerificationCard')).toBeTruthy()
        expect(screen.getByText('AssetDescription')).toBeTruthy()
        expect(screen.getByText('AssetSocialMedia')).toBeTruthy()
    })
})
