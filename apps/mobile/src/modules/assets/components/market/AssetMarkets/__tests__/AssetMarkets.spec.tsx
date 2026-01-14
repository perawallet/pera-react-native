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

// Use absolute paths with aliases to ensure accurate mocking
vi.mock('@modules/assets/components/AssetTitle', () => ({
    default: () => <div>AssetTitle</div>,
}))
vi.mock(
    '@modules/assets/components/market/AssetPriceChart/AssetPriceChart',
    () => ({ default: () => <div>AssetPriceChart</div> }),
)
vi.mock(
    '@modules/assets/components/market/AssetMarketStats/AssetMarketStats',
    () => ({ default: () => <div>AssetMarketStats</div> }),
)
vi.mock('@modules/assets/components/market/AssetAbout/AssetAbout', () => ({
    default: () => <div>AssetAbout</div>,
}))
vi.mock(
    '@modules/assets/components/market/AssetVerificationCard/AssetVerificationCard',
    () => ({ default: () => <div>AssetVerificationCard</div> }),
)
vi.mock(
    '@modules/assets/components/market/AssetDescription/AssetDescription',
    () => ({ default: () => <div>AssetDescription</div> }),
)
vi.mock(
    '@modules/assets/components/market/AssetSocialMedia/AssetSocialMedia',
    () => ({ default: () => <div>AssetSocialMedia</div> }),
)
vi.mock('@modules/assets/components/market/PriceTrend/PriceTrend', () => ({
    default: () => <div>PriceTrend</div>,
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(() => ({
            data: { assetId: '123' },
            isPending: false,
            isError: false,
        })),
        useAssetFiatPricesQuery: vi.fn(() => ({
            data: new Map(),
        })),
    }
})

vi.mock('@hooks/chart-interaction', () => ({
    useChartInteraction: () => ({
        period: 'day',
        setPeriod: vi.fn(),
        selectedPoint: null,
        setSelectedPoint: vi.fn(),
    }),
}))

const mockAsset = {
    assetId: '123',
    name: 'Test Asset',
    unitName: 'TEST',
} as PeraAsset

describe('AssetMarkets', () => {
    it('renders all sections correctly', () => {
        const { container } = render(<AssetMarkets asset={mockAsset} />)

        expect(container.textContent).toContain('AssetTitle')
        expect(container.textContent).toContain('AssetMarketStats')
        expect(container.textContent).toContain('AssetAbout')
        expect(container.textContent).toContain('AssetVerificationCard')
        expect(container.textContent).toContain('AssetDescription')
        expect(container.textContent).toContain('AssetSocialMedia')
    })
})
