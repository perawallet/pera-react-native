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
import { Decimal } from 'decimal.js'
import { useCollectibleInfo } from '../useCollectibleInfo'
import type { PeraAsset } from '@perawallet/wallet-core-assets'

const mockPushWebView = vi.fn()
const mockOpenURL = vi.fn()
const mockNavigate = vi.fn()

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

vi.mock('react-native', () => ({
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        useNetwork: () => ({ network: 'mainnet' }),
    }
})

// Mutable for the same reason as `mockCapabilities`: `custom` has an empty
// explorerUrl by design, and that case needs to be reachable per-test.
const { mockNetworkConfig } = vi.hoisted(() => ({
    mockNetworkConfig: { explorerUrl: 'https://explorer.perawallet.app' },
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        getNetworkConfig: () => mockNetworkConfig,
    }
})

const makeAsset = (): PeraAsset =>
    ({
        assetId: '12345',
        name: 'Cool NFT',
        decimals: 0,
        totalSupply: new Decimal(1),
        creator: { address: 'CREATOR_ADDRESS' },
        peraMetadata: {
            isDeleted: false,
            verificationTier: 'verified',
            type: 'collectible',
        },
    }) as PeraAsset

describe('useCollectibleInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
        Object.assign(mockNetworkConfig, {
            explorerUrl: 'https://explorer.perawallet.app',
        })
    })

    describe('on a network with no explorer', () => {
        beforeEach(() => {
            Object.assign(mockNetworkConfig, { explorerUrl: '' })
        })

        it('offers no creator or asset explorer action', () => {
            // `custom` has explorerUrl: '' by design; interpolating it opens the
            // schemeless relative paths '/address/…' and '/asset/…'.
            const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

            expect(result.current.onCreatorPressed).toBeUndefined()
            expect(result.current.onOpenExplorer).toBeUndefined()
        })

        it('still navigates to AssetDetails, which does not need an explorer', () => {
            const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

            result.current.onAssetIdPressed()

            expect(mockNavigate).toHaveBeenCalled()
        })
    })

    describe('on native (inAppWebView on)', () => {
        it('pushes the creator address into the in-app webview', () => {
            const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

            result.current.onCreatorPressed?.()

            expect(mockPushWebView).toHaveBeenCalledWith({
                url: 'https://explorer.perawallet.app/address/CREATOR_ADDRESS',
            })
            expect(mockOpenURL).not.toHaveBeenCalled()
        })

        it('pushes the asset explorer URL into the in-app webview', () => {
            const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

            result.current.onOpenExplorer?.()

            expect(mockPushWebView).toHaveBeenCalledWith({
                url: 'https://explorer.perawallet.app/asset/12345',
            })
            expect(mockOpenURL).not.toHaveBeenCalled()
        })
    })

    describe('on web (inAppWebView off)', () => {
        beforeEach(() => {
            Object.assign(mockCapabilities, { inAppWebView: false })
        })

        it('opens the creator address in a real browser tab instead of the in-app webview', () => {
            const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

            result.current.onCreatorPressed?.()

            expect(mockOpenURL).toHaveBeenCalledWith(
                'https://explorer.perawallet.app/address/CREATOR_ADDRESS',
            )
            expect(mockPushWebView).not.toHaveBeenCalled()
        })

        it('opens the asset explorer URL in a real browser tab instead of the in-app webview', () => {
            const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

            result.current.onOpenExplorer?.()

            expect(mockOpenURL).toHaveBeenCalledWith(
                'https://explorer.perawallet.app/asset/12345',
            )
            expect(mockPushWebView).not.toHaveBeenCalled()
        })
    })

    it('navigates to AssetDetails when the asset id row is pressed', () => {
        const { result } = renderHook(() => useCollectibleInfo(makeAsset()))

        result.current.onAssetIdPressed()

        expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
            assetId: '12345',
            isCollectible: true,
        })
    })
})
