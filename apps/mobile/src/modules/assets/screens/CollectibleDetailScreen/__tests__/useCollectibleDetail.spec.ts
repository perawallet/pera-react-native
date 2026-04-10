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
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useCollectibleDetail } from '../useCollectibleDetail'
import type { PeraAsset } from '@perawallet/wallet-core-assets'

const mockCopyToClipboard = vi.fn()
const mockShowToast = vi.fn()
const mockOpenURL = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('react-native', () => ({
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    Platform: { OS: 'ios' },
    Share: { share: vi.fn() },
}))

vi.mock('expo-clipboard', () => ({
    setImageAsync: vi.fn(),
}))

vi.mock('expo-file-system', () => ({
    File: {
        downloadFileAsync: vi.fn().mockResolvedValue({
            uri: 'file://cache/collectible_12345',
            base64: vi.fn().mockResolvedValue('base64data'),
        }),
    },
    Paths: {
        cache: { uri: 'file://cache/' },
    },
}))

vi.mock('expo-media-library', () => ({
    requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
    saveToLibraryAsync: vi.fn(),
}))

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Success: 'success' },
}))

const mockUseSingleAssetDetailsQuery = vi.fn()
const mockUseSelectedAccount = vi.fn()
const mockUseAllAccounts = vi.fn()
const mockUseAccountAssetBalanceQuery = vi.fn()

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: (...args: unknown[]) =>
            mockUseSingleAssetDetailsQuery(...args),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: (...args: unknown[]) =>
            mockUseSelectedAccount(...args),
        useAllAccounts: (...args: unknown[]) => mockUseAllAccounts(...args),
        useAccountAssetBalanceQuery: (...args: unknown[]) =>
            mockUseAccountAssetBalanceQuery(...args),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        truncateAlgorandAddress: (address: string) =>
            address.length > 11
                ? `${address.slice(0, 5)}...${address.slice(-5)}`
                : address,
    }
})

const makeCollectibleAsset = (): PeraAsset => ({
    assetId: '12345',
    name: 'Cool NFT',
    decimals: 0,
    totalSupply: new Decimal(1),
    creator: { address: 'CREATOR_ADDRESS' },
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'verified',
        type: 'collectible',
        explorerUrl: 'https://explorer.perawallet.app/asset/12345',
        projectUrl: 'https://coolnfts.io',
        collectible: {
            title: 'Cool NFT #42',
            standard: 'arc3',
            primaryImage: 'https://example.com/nft.png',
            mediaType: 'image',
            explorerUrl: 'https://explorer.perawallet.app/asset/12345',
            collection: { name: 'Cool Collection' },
            description: 'A very cool NFT',
            traits: [
                { displayName: 'Background', displayValue: 'Blue' },
                { displayName: 'Rarity', displayValue: 'Rare' },
            ],
            media: [
                {
                    type: 'image',
                    previewUrl: 'https://example.com/preview.png',
                    downloadUrl: 'https://example.com/full.png',
                    extension: 'png',
                },
            ],
        },
    },
})

describe('useCollectibleDetail', () => {
    const mockAccount = { address: 'ACCOUNT_ADDRESS' }

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSelectedAccount.mockReturnValue(mockAccount)
        mockUseAllAccounts.mockReturnValue([mockAccount])
        mockUseAccountAssetBalanceQuery.mockReturnValue({
            data: { amount: new Decimal(1), algoValue: new Decimal(0) },
        })
        mockUseSingleAssetDetailsQuery.mockReturnValue({
            data: makeCollectibleAsset(),
            isPending: false,
        })
    })

    it('returns collectible data from asset', () => {
        const { result } = renderHook(() => useCollectibleDetail('12345'))

        expect(result.current.collectible?.title).toBe('Cool NFT #42')
        expect(result.current.collectible?.collection?.name).toBe(
            'Cool Collection',
        )
    })

    it('returns traits and media', () => {
        const { result } = renderHook(() => useCollectibleDetail('12345'))

        expect(result.current.traits).toHaveLength(2)
        expect(result.current.traits[0].displayName).toBe('Background')
        expect(result.current.media).toHaveLength(1)
        expect(result.current.media[0].extension).toBe('png')
    })

    it('returns isPending when loading', () => {
        mockUseSingleAssetDetailsQuery.mockReturnValue({
            data: undefined,
            isPending: true,
        })

        const { result } = renderHook(() => useCollectibleDetail('12345'))

        expect(result.current.isPending).toBe(true)
        expect(result.current.asset).toBeUndefined()
    })

    it('returns empty traits and media when collectible is undefined', () => {
        mockUseSingleAssetDetailsQuery.mockReturnValue({
            data: {
                assetId: '99999',
                name: 'Unknown',
                decimals: 0,
                totalSupply: new Decimal(1),
                creator: { address: '' },
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'unverified',
                    type: 'collectible',
                },
            },
            isPending: false,
        })

        const { result } = renderHook(() => useCollectibleDetail('99999'))

        expect(result.current.traits).toEqual([])
        expect(result.current.media).toEqual([])
        expect(result.current.collectible).toBeUndefined()
    })
})
