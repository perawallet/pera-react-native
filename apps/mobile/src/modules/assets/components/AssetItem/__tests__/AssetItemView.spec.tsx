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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { PWText } from '@components/core'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import { AssetItemView } from '../AssetItemView'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

const asset: DisplayableAsset = {
    assetId: '123',
    name: 'Test Asset',
    unitName: 'TST',
    peraMetadata: { verificationTier: 'verified' },
}

describe('AssetItemView', () => {
    beforeEach(() => {
        mockCopyToClipboard.mockClear()
    })

    it('renders the asset name, subtitle and the right slot', () => {
        render(
            <AssetItemView
                asset={asset}
                right={<PWText>RIGHT</PWText>}
            />,
        )
        expect(screen.getByText('Test Asset')).toBeTruthy()
        expect(screen.getByText('TST - 123')).toBeTruthy()
        expect(screen.getByText('RIGHT')).toBeTruthy()
    })

    it('fires onPress when tapped', () => {
        const onPress = vi.fn()
        render(
            <AssetItemView
                asset={asset}
                onPress={onPress}
                testID='asset-row'
            />,
        )
        fireEvent.click(screen.getByTestId('asset-row'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('shows the favorite star only when showFavorite and the asset is favorited', () => {
        const favorited: DisplayableAsset = {
            ...asset,
            peraMetadata: { verificationTier: 'verified', isFavorited: true },
        }
        const { rerender } = render(<AssetItemView asset={favorited} />)
        expect(screen.queryByTestId('favorite-star-icon')).toBeNull()
        rerender(
            <AssetItemView
                asset={favorited}
                showFavorite
            />,
        )
        expect(screen.getByTestId('favorite-star-icon')).toBeTruthy()
    })

    it('shows the deleted label instead of the asset id when showDeletedLabel and deleted', () => {
        const deleted: DisplayableAsset = {
            ...asset,
            peraMetadata: { verificationTier: 'verified', isDeleted: true },
        }
        render(
            <AssetItemView
                asset={deleted}
                showDeletedLabel
            />,
        )
        expect(screen.queryByText('TST - 123')).toBeNull()
        expect(screen.getByTestId('deleted-label')).toBeTruthy()
    })

    it('copies the asset id on a long press anywhere on the row', () => {
        render(
            <AssetItemView
                asset={asset}
                copyableAssetId
            />,
        )

        // The setup mock maps onLongPress to onContextMenu.
        fireEvent.contextMenu(screen.getByTestId('asset_row_123'))

        expect(mockCopyToClipboard).toHaveBeenCalledWith('123')
    })

    it('never copies for the ALGO row, even with copyableAssetId', () => {
        const algo: DisplayableAsset = {
            assetId: '0',
            name: 'Algo',
            unitName: 'ALGO',
        }
        render(
            <AssetItemView
                asset={algo}
                copyableAssetId
            />,
        )

        fireEvent.contextMenu(screen.getByTestId('asset_row_0'))

        expect(mockCopyToClipboard).not.toHaveBeenCalled()
    })

    it('does not copy when copyableAssetId is off', () => {
        render(<AssetItemView asset={asset} />)

        fireEvent.contextMenu(screen.getByTestId('asset_row_123'))

        expect(mockCopyToClipboard).not.toHaveBeenCalled()
    })

    it('uses the collectible title and collection name for collectibles', () => {
        const collectible: DisplayableAsset = {
            assetId: '456',
            unitName: undefined,
            peraMetadata: {
                type: 'collectible',
                verificationTier: 'unverified',
                collectible: {
                    title: 'Penguin #42',
                    collection: { name: 'Penguins' },
                },
            },
        }
        render(<AssetItemView asset={collectible} />)
        expect(screen.getByText('Penguin #42')).toBeTruthy()
        expect(screen.getByText('Penguins - 456')).toBeTruthy()
    })
})
