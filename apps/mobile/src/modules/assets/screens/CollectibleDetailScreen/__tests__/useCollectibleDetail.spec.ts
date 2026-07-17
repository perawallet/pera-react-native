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
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import * as MediaLibrary from 'expo-media-library/legacy'
import { useCollectibleDetail } from '../useCollectibleDetail'
import type {
    CollectibleMedia,
    PeraAsset,
} from '@perawallet/wallet-core-assets'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'

const mockCopyToClipboard = vi.fn()
const mockShowToast = vi.fn()
const mockShowError = vi.fn()
const mockOpenURL = vi.fn()
const mockOptOut = vi.fn()
const mockGoBack = vi.fn()
const mockCanGoBack = vi.fn(() => true)
const mockRequestBottomSheet = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
    useBottomSheetResult: () => ({ resolve: vi.fn(), dismiss: vi.fn() }),
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

vi.mock(
    '@modules/assets/screens/FullScreenMediaViewer/FullScreenMediaViewer',
    () => ({
        FullScreenMediaViewer: () => null,
    }),
)

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        canGoBack: mockCanGoBack,
    }),
    createNavigationContainerRef: vi.fn(() => ({})),
    NavigationContainer: ({ children }: { children: unknown }) => children,
    NavigationIndependentTree: ({ children }: { children: unknown }) =>
        children,
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptOutMutation: () => ({
        optOut: mockOptOut,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('react-native', () => ({
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    Platform: { OS: 'ios' },
}))

vi.mock('@utils/shareText', () => ({
    shareText: vi.fn(),
}))

vi.mock('expo-clipboard', () => ({
    setImageAsync: vi.fn(),
}))

vi.mock('expo-file-system', () => {
    class File {
        static downloadFileAsync = vi.fn().mockResolvedValue({
            uri: 'file://cache/collectible_12345',
            base64: vi.fn().mockResolvedValue('base64data'),
        })
    }
    return {
        File,
        Paths: {
            cache: { uri: 'file://cache/' },
        },
    }
})

vi.mock('expo-media-library/legacy', () => ({
    requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
    saveToLibraryAsync: vi.fn(),
}))

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Success: 'success' },
}))

// lottie-react-native ships .tsx source under lib/commonjs that vitest can't
// parse as JS. We never actually render the bottom sheet's processing screen
// in this test, so a noop stub is sufficient.
vi.mock('lottie-react-native', () => ({
    default: () => null,
}))

const mockUseSingleAssetDetailsQuery = vi.fn()
const mockUseSelectedAccount = vi.fn()
const mockUseAllAccounts = vi.fn()
const mockUseAccountAssetBalanceQuery = vi.fn()

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        useSingleAssetDetailsQuery: (...args: unknown[]) =>
            mockUseSingleAssetDetailsQuery(...args),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
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
    const actual = (await importOriginal()) as Record<string, unknown>
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

const makeAssetWithMedia = (
    media: Array<Omit<CollectibleMedia, 'extension'> & { extension?: string }>,
    primaryImage?: string,
): PeraAsset =>
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
            collectible: {
                title: 'Cool NFT #42',
                standard: 'arc3',
                primaryImage,
                mediaType: 'image',
                media: media.map(m => ({ extension: 'bin', ...m })),
            },
        },
    }) as PeraAsset

describe('useCollectibleDetail', () => {
    const mockAccount = { address: 'ACCOUNT_ADDRESS' }

    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
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

    it('reports owned state when account has a positive balance', () => {
        const { result } = renderHook(() => useCollectibleDetail('12345'))

        expect(result.current.isOptedIn).toBe(true)
        expect(result.current.isOwned).toBe(true)
        expect(result.current.isOptedInNotOwned).toBe(false)
    })

    it('reports opted-in-not-owned when balance exists with amount 0', () => {
        mockUseAccountAssetBalanceQuery.mockReturnValue({
            data: { amount: new Decimal(0), algoValue: new Decimal(0) },
        })

        const { result } = renderHook(() => useCollectibleDetail('12345'))

        expect(result.current.isOptedIn).toBe(true)
        expect(result.current.isOwned).toBe(false)
        expect(result.current.isOptedInNotOwned).toBe(true)
    })

    it('reports not opted in when balance query returns null', () => {
        mockUseAccountAssetBalanceQuery.mockReturnValue({ data: null })

        const { result } = renderHook(() => useCollectibleDetail('12345'))

        expect(result.current.isOptedIn).toBe(false)
        expect(result.current.isOwned).toBe(false)
        expect(result.current.isOptedInNotOwned).toBe(false)
    })

    it('opts out the asset and navigates back on success', async () => {
        mockUseAccountAssetBalanceQuery.mockReturnValue({
            data: { amount: new Decimal(0), algoValue: new Decimal(0) },
        })
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        mockOptOut.mockResolvedValueOnce({ txIds: ['TX1'] })

        const { result } = renderHook(() => useCollectibleDetail('12345'))

        await result.current.handleOptOutPressed()

        expect(mockOptOut).toHaveBeenCalledWith({
            sender: 'ACCOUNT_ADDRESS',
            assetId: BigInt('12345'),
            creator: 'CREATOR_ADDRESS',
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        )
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('shows an error toast when opt-out fails', async () => {
        mockUseAccountAssetBalanceQuery.mockReturnValue({
            data: { amount: new Decimal(0), algoValue: new Decimal(0) },
        })
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        const optOutError = new Error('signing rejected')
        mockOptOut.mockRejectedValueOnce(optOutError)

        const { result } = renderHook(() => useCollectibleDetail('12345'))

        await result.current.handleOptOutPressed()

        expect(mockShowError).toHaveBeenCalledWith(
            optOutError,
            'asset_opt_out.error',
        )
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockUseAccountAssetBalanceQuery.mockReturnValue({
            data: { amount: new Decimal(0), algoValue: new Decimal(0) },
        })
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        mockOptOut.mockRejectedValueOnce(new UserRejectedSigningError())

        const { result } = renderHook(() => useCollectibleDetail('12345'))

        await result.current.handleOptOutPressed()

        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
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

    describe('hasImage', () => {
        it('is true when an image media item is present', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    {
                        type: 'image',
                        downloadUrl: 'https://example.com/full.png',
                        extension: 'png',
                    },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasImage).toBe(true)
        })

        it('is true when only a primaryImage is present (no image media)', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia(
                    [
                        {
                            type: 'video',
                            downloadUrl: 'https://example.com/v.mp4',
                        },
                    ],
                    'https://example.com/primary.png',
                ),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasImage).toBe(true)
        })

        it('is false for a video-only collectible without a primaryImage', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    { type: 'video', downloadUrl: 'https://example.com/v.mp4' },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasImage).toBe(false)
        })

        it('is false for an empty media list without a primaryImage', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasImage).toBe(false)
        })
    })

    describe('hasSaveableMedia', () => {
        it('is true for image media with a download URL', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    {
                        type: 'image',
                        downloadUrl: 'https://example.com/full.png',
                        extension: 'png',
                    },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasSaveableMedia).toBe(true)
        })

        it('is true for video media with only a preview URL', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    {
                        type: 'video',
                        previewUrl: 'https://example.com/preview.png',
                    },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasSaveableMedia).toBe(true)
        })

        it('falls back to primaryImage when no media is directly saveable', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia(
                    [
                        {
                            type: 'model',
                            downloadUrl: 'https://example.com/m.glb',
                        },
                    ],
                    'https://example.com/primary.png',
                ),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasSaveableMedia).toBe(true)
        })

        it('is false for a model-only collectible without a primaryImage', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    { type: 'model', downloadUrl: 'https://example.com/m.glb' },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            expect(result.current.hasSaveableMedia).toBe(false)
        })
    })

    describe('handleSaveImage', () => {
        it('saves the saveable media to the library when a URL is available', async () => {
            const { result } = renderHook(() => useCollectibleDetail('12345'))

            await result.current.handleSaveImage()

            expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
                'file://cache/collectible_12345',
            )
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            )
        })

        it('bails out without saving when there is no saveable media URL', async () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    { type: 'model', downloadUrl: 'https://example.com/m.glb' },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            await result.current.handleSaveImage()

            expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
            expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled()
        })
    })

    describe('handleModelPress', () => {
        it('opens the model viewer with the model download URL', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    { type: 'model', downloadUrl: 'https://example.com/m.glb' },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            act(() => {
                result.current.handleModelPress()
            })

            expect(result.current.modelViewerModal.isOpen).toBe(true)
            expect(result.current.modelViewerUrl).toBe(
                'https://example.com/m.glb',
            )
        })

        it('does not open the viewer when the model has no download URL', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    {
                        type: 'model',
                        previewUrl: 'https://example.com/m-preview.png',
                    },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            result.current.handleModelPress()

            expect(result.current.modelViewerModal.isOpen).toBe(false)
            expect(result.current.modelViewerUrl).toBeUndefined()
        })

        describe('capability gating (inAppWebView)', () => {
            it('keeps the model in `media` when inAppWebView is on (native)', () => {
                mockUseSingleAssetDetailsQuery.mockReturnValue({
                    data: makeAssetWithMedia([
                        {
                            type: 'model',
                            downloadUrl: 'https://example.com/m.glb',
                        },
                    ]),
                    isPending: false,
                })

                const { result } = renderHook(() =>
                    useCollectibleDetail('12345'),
                )

                expect(result.current.media.some(m => m.type === 'model')).toBe(
                    true,
                )
            })

            it('drops the model from `media` when inAppWebView is off (web)', () => {
                Object.assign(mockCapabilities, { inAppWebView: false })
                mockUseSingleAssetDetailsQuery.mockReturnValue({
                    data: makeAssetWithMedia([
                        {
                            type: 'model',
                            downloadUrl: 'https://example.com/m.glb',
                        },
                    ]),
                    isPending: false,
                })

                const { result } = renderHook(() =>
                    useCollectibleDetail('12345'),
                )

                expect(result.current.media.some(m => m.type === 'model')).toBe(
                    false,
                )
            })

            it('does not open the viewer when inAppWebView is off, even with a valid model URL', () => {
                Object.assign(mockCapabilities, { inAppWebView: false })
                mockUseSingleAssetDetailsQuery.mockReturnValue({
                    data: makeAssetWithMedia([
                        {
                            type: 'model',
                            downloadUrl: 'https://example.com/m.glb',
                        },
                    ]),
                    isPending: false,
                })

                const { result } = renderHook(() =>
                    useCollectibleDetail('12345'),
                )

                act(() => {
                    result.current.handleModelPress()
                })

                expect(result.current.modelViewerModal.isOpen).toBe(false)
                expect(result.current.modelViewerUrl).toBeUndefined()
            })
        })
    })

    describe('handleFullScreenPress', () => {
        it('opens the full-screen media viewer for a visual media index', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    {
                        type: 'image',
                        downloadUrl: 'https://example.com/full.png',
                        extension: 'png',
                    },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            result.current.handleFullScreenPress(0)

            expect(mockRequestBottomSheet).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({ size: 'full' }),
                }),
            )
        })

        it('does not open the viewer when there is no visual media', () => {
            mockUseSingleAssetDetailsQuery.mockReturnValue({
                data: makeAssetWithMedia([
                    { type: 'model', downloadUrl: 'https://example.com/m.glb' },
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useCollectibleDetail('12345'))

            result.current.handleFullScreenPress(0)

            expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        })
    })
})
