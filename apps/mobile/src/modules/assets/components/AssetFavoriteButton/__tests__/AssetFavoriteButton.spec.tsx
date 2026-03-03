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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@test-utils/render'

const mockToggleAssetFavorite = vi.fn()
const mockUseToggleAssetFavoriteMutation = vi.fn(() => ({
    toggleAssetFavorite: mockToggleAssetFavorite,
    isLoading: false,
    isError: false,
    error: null,
    isSuccess: false,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useToggleAssetFavoriteMutation: () => mockUseToggleAssetFavoriteMutation(),
}))

vi.mock('@perawallet/wallet-extension-platform', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-extension-platform')
        >()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
        useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
    }
})

import { AssetFavoriteButton } from '../AssetFavoriteButton'

describe('AssetFavoriteButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseToggleAssetFavoriteMutation.mockReturnValue({
            toggleAssetFavorite: mockToggleAssetFavorite,
            isLoading: false,
            isError: false,
            error: null,
            isSuccess: false,
        })
    })

    it('renders correctly when asset is not favorited', () => {
        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={false}
            />,
        )

        expect(container).toBeTruthy()
    })

    it('renders correctly when asset is favorited', () => {
        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={true}
            />,
        )

        expect(container).toBeTruthy()
    })

    it('calls toggleAssetFavorite when pressed', () => {
        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button).toBeTruthy()
        if (button) {
            fireEvent.click(button)
        }

        expect(mockToggleAssetFavorite).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'test-device-id',
                enabled: true,
                network: 'mainnet',
            }),
        )
    })

    it('toggles from favorited to unfavorited', () => {
        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={true}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button).toBeTruthy()
        if (button) {
            fireEvent.click(button)
        }

        expect(mockToggleAssetFavorite).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'test-device-id',
                enabled: false,
                network: 'mainnet',
            }),
        )
    })

    it('is disabled when isFavorite is undefined', () => {
        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={undefined}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when isLoading is true', () => {
        mockUseToggleAssetFavoriteMutation.mockReturnValue({
            toggleAssetFavorite: mockToggleAssetFavorite,
            isLoading: true,
            isError: false,
            error: null,
            isSuccess: false,
        })

        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when deviceId is null', async () => {
        const module = await import('@perawallet/wallet-extension-platform')
        vi.mocked(module.useDeviceID).mockReturnValue(null)

        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when isLoading is true', () => {
        mockUseToggleAssetFavoriteMutation.mockReturnValue({
            toggleAssetFavorite: mockToggleAssetFavorite,
            isLoading: true,
            isError: false,
            error: null,
            isSuccess: false,
        })

        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when deviceId is null', async () => {
        const module = await import('@perawallet/wallet-extension-platform')
        vi.mocked(module.useDeviceID).mockReturnValue(null)

        const { container } = render(
            <AssetFavoriteButton
                assetId='123'
                isFavorite={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })
})
