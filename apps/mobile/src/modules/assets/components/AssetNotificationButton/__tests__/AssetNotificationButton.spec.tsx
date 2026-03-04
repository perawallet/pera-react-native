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

const mockToggleAssetPriceAlert = vi.fn()
const mockUseToggleAssetPriceAlertMutation = vi.fn(() => ({
    toggleAssetPriceAlert: mockToggleAssetPriceAlert,
    isLoading: false,
    isError: false,
    error: null,
    isSuccess: false,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useToggleAssetPriceAlertMutation: () =>
        mockUseToggleAssetPriceAlertMutation(),
}))

vi.mock('@perawallet/wallet-extension-platform', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-extension-platform')
        >()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

import { AssetNotificationButton } from '../AssetNotificationButton'

describe('AssetNotificationButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseToggleAssetPriceAlertMutation.mockReturnValue({
            toggleAssetPriceAlert: mockToggleAssetPriceAlert,
            isLoading: false,
            isError: false,
            error: null,
            isSuccess: false,
        })
    })

    it('renders correctly when notifications are disabled', () => {
        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={false}
            />,
        )

        expect(container).toBeTruthy()
    })

    it('renders correctly when notifications are enabled', () => {
        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={true}
            />,
        )

        expect(container).toBeTruthy()
    })

    it('calls toggleAssetPriceAlert when pressed', () => {
        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button).toBeTruthy()
        if (button) {
            fireEvent.click(button)
        }

        expect(mockToggleAssetPriceAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'test-device-id',
                enabled: true,
                network: 'mainnet',
            }),
        )
    })

    it('toggles from enabled to disabled', () => {
        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={true}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button).toBeTruthy()
        if (button) {
            fireEvent.click(button)
        }

        expect(mockToggleAssetPriceAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'test-device-id',
                enabled: false,
                network: 'mainnet',
            }),
        )
    })

    it('is disabled when isNotificationsEnabled is undefined', () => {
        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={undefined}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when isLoading is true', () => {
        mockUseToggleAssetPriceAlertMutation.mockReturnValue({
            toggleAssetPriceAlert: mockToggleAssetPriceAlert,
            isLoading: true,
            isError: false,
            error: null,
            isSuccess: false,
        })

        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when deviceId is null', async () => {
        const module = await import('@perawallet/wallet-extension-platform')
        vi.mocked(module.useDeviceID).mockReturnValue(null)

        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when isLoading is true', () => {
        mockUseToggleAssetPriceAlertMutation.mockReturnValue({
            toggleAssetPriceAlert: mockToggleAssetPriceAlert,
            isLoading: true,
            isError: false,
            error: null,
            isSuccess: false,
        })

        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })

    it('is disabled when deviceId is null', async () => {
        const module = await import('@perawallet/wallet-extension-platform')
        vi.mocked(module.useDeviceID).mockReturnValue(null)

        const { container } = render(
            <AssetNotificationButton
                assetId='123'
                isNotificationsEnabled={false}
            />,
        )

        const button = container.querySelector('[role="button"]')
        expect(button?.hasAttribute('disabled')).toBe(true)
    })
})
