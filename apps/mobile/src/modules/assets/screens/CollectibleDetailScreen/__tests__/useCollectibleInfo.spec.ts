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
const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

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

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

// Mutable for the same reason as `mockCapabilities`: a network with no
// explorer (a custom one) needs to be reachable per-test.
const { mockExplorer, mockChainUi } = vi.hoisted(() => ({
    mockExplorer: { base: 'https://explorer.perawallet.app' },
    mockChainUi: { collectibleDetails: undefined as unknown },
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    const link = (path: string) => (_networkId: string, id: string) =>
        mockExplorer.base ? `${mockExplorer.base}/${path}/${id}` : undefined
    return {
        ...actual,
        getChainDescriptor: () => ({
            family: 'algorand',
            explorer: {
                accountUrl: link('address'),
                collectibleUrl: link('asset'),
            },
        }),
    }
})

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        addressCodecs: {
            get: () => ({ truncate: (address: string) => `short:${address}` }),
        },
    }
})

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: () => mockChainUi,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const ALGORAND_DISPLAY = {
    identityLabelKey: 'asset_details.collectible.asset_id',
    creatorLabelKey: 'asset_details.collectible.creator',
    hasTotalSupply: true,
    explorerLabelKey: 'asset_details.collectible.explorer',
}

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
        mockExplorer.base = 'https://explorer.perawallet.app'
        mockChainUi.collectibleDetails = ALGORAND_DISPLAY
    })

    describe('on a network with no explorer', () => {
        beforeEach(() => {
            mockExplorer.base = ''
        })

        it('offers no creator or asset explorer action', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            expect(result.current.onCreatorPressed).toBeUndefined()
            expect(result.current.onOpenExplorer).toBeUndefined()
        })

        it('still navigates to AssetDetails, which does not need an explorer', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onAssetIdPressed()

            expect(mockNavigate).toHaveBeenCalled()
        })
    })

    describe('on native (inAppWebView on)', () => {
        it('pushes the creator address into the in-app webview', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onCreatorPressed?.()

            expect(mockPushWebView).toHaveBeenCalledWith({
                url: 'https://explorer.perawallet.app/address/CREATOR_ADDRESS',
            })
            expect(mockOpenURL).not.toHaveBeenCalled()
        })

        it('pushes the asset explorer URL into the in-app webview', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

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
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onCreatorPressed?.()

            expect(mockOpenURL).toHaveBeenCalledWith(
                'https://explorer.perawallet.app/address/CREATOR_ADDRESS',
            )
            expect(mockPushWebView).not.toHaveBeenCalled()
        })

        it('opens the asset explorer URL in a real browser tab instead of the in-app webview', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onOpenExplorer?.()

            expect(mockOpenURL).toHaveBeenCalledWith(
                'https://explorer.perawallet.app/asset/12345',
            )
            expect(mockPushWebView).not.toHaveBeenCalled()
        })
    })

    it('navigates to AssetDetails when the asset id row is pressed', () => {
        const { result } = renderHook(() =>
            useCollectibleInfo(makeAsset(), SCOPE),
        )

        result.current.onAssetIdPressed()

        expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
            assetId: '12345',
            chainId: 'algorand',
            isCollectible: true,
        })
    })

    describe('rows the chain supplies', () => {
        it("takes Algorand's labels, supply row and explorer label from its display", () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            expect(result.current).toMatchObject({
                identityLabelKey: 'asset_details.collectible.asset_id',
                creatorLabelKey: 'asset_details.collectible.creator',
                hasTotalSupply: true,
                explorerLabelKey: 'asset_details.collectible.explorer',
            })
        })

        it('falls back to the neutral rows on a chain with no collectible display', () => {
            mockChainUi.collectibleDetails = undefined

            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            expect(result.current).toMatchObject({
                identityLabelKey: 'asset_details.collectible.token_id',
                creatorLabelKey: 'asset_details.collectible.contract',
                hasTotalSupply: false,
                explorerLabelKey: null,
                explorerDomain: 'explorer.perawallet.app',
            })
        })

        it("truncates the creator through the chain's address codec", () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            expect(result.current.creatorDisplayAddress).toBe(
                'short:CREATOR_ADDRESS',
            )
        })

        it('navigates to AssetDetails on the scope chain', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), {
                    chainId: 'ethereum',
                    networkId: 'mainnet',
                }),
            )

            result.current.onAssetIdPressed()

            expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
                assetId: '12345',
                chainId: 'ethereum',
                isCollectible: true,
            })
        })
    })

    describe('long-press copy', () => {
        it('copies the full (untruncated) creator address', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onCreatorLongPressed()

            expect(mockCopyToClipboard).toHaveBeenCalledWith('CREATOR_ADDRESS')
            expect(mockPushWebView).not.toHaveBeenCalled()
            expect(mockOpenURL).not.toHaveBeenCalled()
        })

        it('copies the asset id without navigating', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onAssetIdLongPressed()

            expect(mockCopyToClipboard).toHaveBeenCalledWith('12345')
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('still copies on a network with no explorer', () => {
            mockExplorer.base = ''
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onCreatorLongPressed()

            expect(mockCopyToClipboard).toHaveBeenCalledWith('CREATOR_ADDRESS')
        })
    })
})
