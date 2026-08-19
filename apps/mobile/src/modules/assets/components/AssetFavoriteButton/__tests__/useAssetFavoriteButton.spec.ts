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
import { renderHook } from '@testing-library/react'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { useAssetFavoriteButton } from '../useAssetFavoriteButton'

const mocks = vi.hoisted(() => ({
    toggleAssetFavorite: vi.fn(),
    invalidate: vi.fn(),
    showError: vi.fn(),
    isLoading: false,
    isUnavailableOnNetwork: false,
    deviceId: 'device-1',
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountHoldingsInvalidator: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => mocks.deviceId,
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'betanet' }),
}))
vi.mock('@perawallet/wallet-core-assets', () => ({
    useToggleAssetFavoriteMutation: () => ({
        toggleAssetFavorite: mocks.toggleAssetFavorite,
        isLoading: mocks.isLoading,
        isUnavailableOnNetwork: mocks.isUnavailableOnNetwork,
    }),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

describe('useAssetFavoriteButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isLoading = false
        mocks.isUnavailableOnNetwork = false
        mocks.deviceId = 'device-1'
    })

    it('toggles the favorite mutation when the device id and current state are known', () => {
        const { result } = renderHook(() =>
            useAssetFavoriteButton('123', false),
        )

        result.current.handleToggleFavorite()

        expect(mocks.toggleAssetFavorite).toHaveBeenCalledWith({
            assetID: '123',
            deviceId: 'device-1',
            enabled: true,
            network: 'betanet',
        })
        expect(mocks.showError).not.toHaveBeenCalled()
    })

    it('is disabled while the current favorite state is unknown', () => {
        const { result } = renderHook(() =>
            useAssetFavoriteButton('123', undefined),
        )

        expect(result.current.isDisabled).toBe(true)
    })

    it('is disabled while the mutation is in flight', () => {
        mocks.isLoading = true

        const { result } = renderHook(() =>
            useAssetFavoriteButton('123', false),
        )

        expect(result.current.isDisabled).toBe(true)
    })

    it('shows the Pera-service-unavailable toast instead of dispatching a doomed mutation', () => {
        mocks.isUnavailableOnNetwork = true

        const { result } = renderHook(() =>
            useAssetFavoriteButton('123', false),
        )

        result.current.handleToggleFavorite()

        expect(mocks.toggleAssetFavorite).not.toHaveBeenCalled()
        expect(mocks.showError).toHaveBeenCalledTimes(1)
        const [error] = mocks.showError.mock.calls[0]
        expect(error).toBeInstanceOf(PeraServiceUnavailableError)
    })

    it('stays interactive on a network with no Pera backend — not the disabled control', () => {
        // Tappable-not-disabled is deliberate: a truly disabled control
        // swallows the press and the user never learns why.
        mocks.isUnavailableOnNetwork = true

        const { result } = renderHook(() =>
            useAssetFavoriteButton('123', false),
        )

        expect(result.current.isDisabled).toBe(false)
        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })
})
