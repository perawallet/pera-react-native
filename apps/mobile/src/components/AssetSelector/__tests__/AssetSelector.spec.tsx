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

import { vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import { AssetSelector } from '../AssetSelector'

const mockUseAssetsQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: mockUseAssetsQuery,
}))

describe('AssetSelector', () => {
    it('renders the pre-resolved label and fires onPress', () => {
        const onPress = vi.fn()
        render(
            <AssetSelector
                variant='pay'
                asset={undefined}
                chainId={null}
                label='USDC'
                onPress={onPress}
                testID='asset-selector'
            />,
        )

        expect(screen.getByText('USDC')).toBeTruthy()

        fireEvent.click(screen.getByTestId('asset-selector'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('shows the fallback label when an asset id has no resolved asset', () => {
        render(
            <AssetSelector
                variant='receive'
                assetId='unknown-asset-id'
                fallbackLabel='Select asset'
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('Select asset')).toBeTruthy()
    })

    it('fetches an asset id missing from the local DB', () => {
        render(
            <AssetSelector
                variant='receive'
                assetId='31566704'
                onPress={vi.fn()}
            />,
        )

        expect(mockUseAssetsQuery).toHaveBeenCalledWith(
            expect.anything(),
            ['31566704'],
            { fetchMissing: true },
        )
    })
})
