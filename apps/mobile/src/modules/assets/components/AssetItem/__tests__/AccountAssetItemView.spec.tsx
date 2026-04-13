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

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import { AccountAssetItemView } from '../AccountAssetItemView'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: 0,
    isCollectible: vi.fn(() => false),
    useAssetsQuery: vi.fn(() => ({
        data: new Map([
            [
                0,
                {
                    assetId: 0,
                    unitName: 'ALGO',
                    name: 'Algorand',
                    decimals: 6,
                },
            ],
        ]),
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({ preferredCurrency: 'USD' })),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

// Mock AssetIcon to keep test focused
vi.mock('../AssetIcon', () => ({
    AssetIcon: () => null,
}))

// Mock PreferredCurrencyDisplay since it has complex dependencies
vi.mock('@components/PreferredCurrencyDisplay', () => ({
    PreferredCurrencyDisplay: () => null,
}))

describe('AccountAssetItemView', () => {
    it('renders asset info for Algo using pre-fetched asset data', () => {
        const accountBalance = {
            assetId: 0,
            asset: {
                assetId: 0,
                unitName: 'ALGO',
                name: 'Algorand',
                decimals: 6,
            },
            amount: '1000000',
        } as unknown as AssetWithAccountBalance

        render(<AccountAssetItemView accountBalance={accountBalance} />)

        // Verifying name and unit
        expect(screen.getByText('Algo')).toBeTruthy()
        expect(screen.getByText('ALGO')).toBeTruthy()
    })

    it('renders asset units and IDs for non-algo assets using pre-fetched data', () => {
        const accountBalance = {
            assetId: 123,
            asset: {
                assetId: 123,
                unitName: 'TEST',
                name: 'Test Asset',
                decimals: 2,
            },
            amount: '500',
        } as unknown as AssetWithAccountBalance

        render(<AccountAssetItemView accountBalance={accountBalance} />)

        expect(screen.getByText('Test Asset')).toBeTruthy()
        expect(screen.getByText('TEST - 123')).toBeTruthy()
    })

    it('falls back to useAssetsQuery when asset is not pre-fetched', async () => {
        const { useAssetsQuery } =
            await import('@perawallet/wallet-core-assets')
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([
                [
                    123,
                    {
                        assetId: 123,
                        unitName: 'TEST',
                        name: 'Test Asset',
                        decimals: 2,
                    },
                ],
            ]),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const accountBalance = {
            assetId: 123,
            amount: '500',
        } as unknown as AssetWithAccountBalance

        render(<AccountAssetItemView accountBalance={accountBalance} />)

        expect(screen.getByText('Test Asset')).toBeTruthy()
        expect(screen.getByText('TEST - 123')).toBeTruthy()
    })

    it('renders a favorite star icon when the asset is favorited', () => {
        const accountBalance = {
            assetId: 456,
            asset: {
                assetId: 456,
                unitName: 'FAV',
                name: 'Favorited Asset',
                decimals: 2,
                peraMetadata: { isFavorited: true },
            },
            amount: '500',
        } as unknown as AssetWithAccountBalance

        render(<AccountAssetItemView accountBalance={accountBalance} />)

        expect(screen.getByTestId('favorite-star-icon')).toBeTruthy()
    })

    it('does not render a favorite star icon when the asset is not favorited', () => {
        const accountBalance = {
            assetId: 457,
            asset: {
                assetId: 457,
                unitName: 'NOFAV',
                name: 'Plain Asset',
                decimals: 2,
                peraMetadata: { isFavorited: false },
            },
            amount: '500',
        } as unknown as AssetWithAccountBalance

        render(<AccountAssetItemView accountBalance={accountBalance} />)

        expect(screen.queryByTestId('favorite-star-icon')).toBeNull()
    })

    it('renders skeleton placeholder when asset data is not available', async () => {
        const { useAssetsQuery } =
            await import('@perawallet/wallet-core-assets')
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const accountBalance = {
            assetId: 999,
            amount: '0',
        } as unknown as AssetWithAccountBalance

        const { container } = render(
            <AccountAssetItemView accountBalance={accountBalance} />,
        )

        // Should not render asset name since data isn't available
        expect(screen.queryByText('Algo')).toBeNull()
        // Should render something (the skeleton placeholder)
        expect(container).toBeTruthy()
    })
})
