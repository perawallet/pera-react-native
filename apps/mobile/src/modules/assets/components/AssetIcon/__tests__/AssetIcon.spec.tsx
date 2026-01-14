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
import AssetIcon from '../AssetIcon'
import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/wallet-core-assets'

// Mock SVG
vi.mock('@assets/icons/assets/algo.svg', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (props: any) =>
        React.createElement('svg', { ...props, 'data-testid': 'ALGO_ICON' }),
}))

describe('AssetIcon', () => {
    it('renders Algo icon for ALGO_ASSET_ID', () => {
        const asset = { assetId: ALGO_ASSET_ID } as PeraAsset
        render(<AssetIcon asset={asset} />)
        expect(screen.getByTestId('ALGO_ICON')).toBeTruthy()
    })

    it('renders Image for asset with logo', () => {
        const asset = {
            assetId: 123,
            peraMetadata: { logo: 'https://logo.url' },
        } as unknown as PeraAsset
        render(<AssetIcon asset={asset} />)
        expect(screen.getByTestId('RNEImage')).toBeTruthy()
    })

    it('renders first letter for asset without logo', () => {
        const asset = {
            assetId: 123,
            unitName: 'TEST',
        } as unknown as PeraAsset
        render(<AssetIcon asset={asset} />)
        expect(screen.getByText('T')).toBeTruthy()
    })
})
