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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useCollectibleInfo } from '../useCollectibleInfo'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

const mockOpenExplorerUrl = vi.fn()
const mockNavigate = vi.fn()
const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@modules/webview', () => ({
    openExplorerUrl: (url: string) => mockOpenExplorerUrl(url),
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

// Mutable so a network with no explorer (a custom one) is reachable per-test.
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
const ETHEREUM_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const CONTRACT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'

// The shape `ethereumCollectibleDetailsDisplay` has (pinned in the Ethereum
// chain-ui spec); the real one pulls React Native into this spec.
const ethereumCollectibleDetailsDisplay = {
    identityLabelKey: 'asset_details.collectible.token_id',
    creatorLabelKey: 'asset_details.collectible.contract',
    hasTotalSupply: false,
    explorerLabelKey: null,
    isIdentityLinked: false,
    identityOf: (assetId: string) => assetId.split('/')[1] ?? assetId,
    standardLabels: { erc721: 'ERC-721', erc1155: 'ERC-1155' },
}

const ALGORAND_DISPLAY = {
    identityLabelKey: 'asset_details.collectible.asset_id',
    creatorLabelKey: 'asset_details.collectible.creator',
    hasTotalSupply: true,
    explorerLabelKey: 'asset_details.collectible.explorer',
    isIdentityLinked: true,
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
        mockExplorer.base = 'https://explorer.perawallet.app'
        mockChainUi.collectibleDetails = ALGORAND_DISPLAY
    })

    afterEach(() => {
        vi.mocked(truncateAlgorandAddress).mockImplementation(a => a)
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

            result.current.onAssetIdPressed?.()

            expect(mockNavigate).toHaveBeenCalled()
        })
    })

    it('opens the creator address on the explorer in the system browser', () => {
        const { result } = renderHook(() =>
            useCollectibleInfo(makeAsset(), SCOPE),
        )

        result.current.onCreatorPressed?.()

        expect(mockOpenExplorerUrl).toHaveBeenCalledWith(
            'https://explorer.perawallet.app/address/CREATOR_ADDRESS',
        )
    })

    it('opens the asset explorer URL in the system browser', () => {
        const { result } = renderHook(() =>
            useCollectibleInfo(makeAsset(), SCOPE),
        )

        result.current.onOpenExplorer?.()

        expect(mockOpenExplorerUrl).toHaveBeenCalledWith(
            'https://explorer.perawallet.app/asset/12345',
        )
    })

    it('navigates to AssetDetails when the asset id row is pressed', () => {
        const { result } = renderHook(() =>
            useCollectibleInfo(makeAsset(), SCOPE),
        )

        result.current.onAssetIdPressed?.()

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

            result.current.onAssetIdPressed?.()

            expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
                assetId: '12345',
                chainId: 'ethereum',
                isCollectible: true,
            })
        })
    })

    describe('identity row', () => {
        it('shows the asset id and no standard row where the chain lists none', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            expect(result.current.identityDisplay).toBe('12345')
            expect(result.current.standardLabel).toBeUndefined()
            expect(result.current.onAssetIdPressed).toBeDefined()
        })

        it('shows only the token id of an Ethereum NFT, labelled with its standard, and does not link it', () => {
            mockChainUi.collectibleDetails = ethereumCollectibleDetailsDisplay
            const asset = {
                ...makeAsset(),
                assetId: `${CONTRACT}/42`,
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    type: 'collectible',
                    collectible: { standard: 'erc1155' },
                },
            } as PeraAsset
            const { result } = renderHook(() =>
                useCollectibleInfo(asset, ETHEREUM_SCOPE),
            )

            expect(result.current).toMatchObject({
                identityLabelKey: 'asset_details.collectible.token_id',
                identityDisplay: '42',
                standardLabel: 'ERC-1155',
            })
            expect(result.current.onAssetIdPressed).toBeUndefined()
        })

        it('shortens a 78-digit token id on the row and copies it whole', () => {
            mockChainUi.collectibleDetails = ethereumCollectibleDetailsDisplay
            // The shared mock of the package returns its input unchanged.
            vi.mocked(truncateAlgorandAddress).mockImplementation(
                (address, max = 11) =>
                    `${address.slice(0, max / 2)}...${address.slice(-max / 2)}`,
            )
            const tokenId = '9'.repeat(78)
            const asset = {
                ...makeAsset(),
                assetId: `${CONTRACT}/${tokenId}`,
            } as PeraAsset
            const { result } = renderHook(() =>
                useCollectibleInfo(asset, ETHEREUM_SCOPE),
            )

            result.current.onAssetIdLongPressed()

            expect(result.current.identityDisplay).toBe(
                `${'9'.repeat(10)}...${'9'.repeat(10)}`,
            )
            expect(mockCopyToClipboard).toHaveBeenCalledWith(tokenId)
        })

        it('shows no standard row for a standard the chain does not name', () => {
            mockChainUi.collectibleDetails = ethereumCollectibleDetailsDisplay
            const asset = {
                ...makeAsset(),
                assetId: `${CONTRACT}/1`,
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    type: 'collectible',
                    collectible: { standard: 'arc3' },
                },
            } as PeraAsset
            const { result } = renderHook(() =>
                useCollectibleInfo(asset, ETHEREUM_SCOPE),
            )

            expect(result.current.standardLabel).toBeUndefined()
        })
    })

    describe('long-press copy', () => {
        it('copies the full (untruncated) creator address', () => {
            const { result } = renderHook(() =>
                useCollectibleInfo(makeAsset(), SCOPE),
            )

            result.current.onCreatorLongPressed()

            expect(mockCopyToClipboard).toHaveBeenCalledWith('CREATOR_ADDRESS')
            expect(mockOpenExplorerUrl).not.toHaveBeenCalled()
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
