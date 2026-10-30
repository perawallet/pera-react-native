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
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useAssetItemView } from '../useAssetItemView'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

const make = (overrides: Partial<DisplayableAsset> = {}): DisplayableAsset => ({
    assetId: '123',
    name: 'Test Asset',
    unitName: 'TST',
    ...overrides,
})

const useView = (
    asset: DisplayableAsset,
    options: { chainId?: ChainId; copyableAssetId?: boolean } = {},
) => useAssetItemView(asset, { chainId: 'algorand', ...options })

describe('useAssetItemView', () => {
    it('derives a standard asset row', () => {
        const { result } = renderHook(() => useView(make()))
        expect(result.current.isCollectible).toBe(false)
        expect(result.current.displayName).toBe('Test Asset')
        expect(result.current.secondaryText).toBe('TST · 123')
        expect(result.current.iconShape).toBe('circle')
    })

    it('falls back to "Asset #<id>" when unnamed', () => {
        const { result } = renderHook(() => useView(make({ name: undefined })))
        expect(result.current.displayName).toBe('Asset #123')
    })

    it('falls back to "Asset #<id>" when the name is an empty string', () => {
        const { result } = renderHook(() => useView(make({ name: '' })))
        expect(result.current.displayName).toBe('Asset #123')
    })

    it('renders the verified verification icon from the tier', () => {
        const { result } = renderHook(() =>
            useView(make({ peraMetadata: { verificationTier: 'verified' } })),
        )
        expect(result.current.verificationIcon).toBe('assets/verified')
    })

    it('marks suspicious assets', () => {
        const { result } = renderHook(() =>
            useView(make({ peraMetadata: { verificationTier: 'suspicious' } })),
        )
        expect(result.current.isSuspicious).toBe(true)
        expect(result.current.verificationIcon).toBe('assets/suspicious')
    })

    it('treats ALGO specially', () => {
        const { result } = renderHook(() =>
            useView(make({ assetId: '0', name: 'Algo', unitName: 'ALGO' })),
        )
        expect(result.current.isNativeAsset).toBe(true)
        expect(result.current.displayName).toBe('Algo')
        expect(result.current.verificationIcon).toBe('assets/trusted')
        expect(result.current.secondaryText).toBe('ALGO')
    })

    it('derives a collectible row (square icon, collection subtitle)', () => {
        const { result } = renderHook(() =>
            useView(
                make({
                    name: undefined,
                    peraMetadata: {
                        type: 'collectible',
                        verificationTier: 'unverified',
                        collectible: {
                            title: 'Penguin #42',
                            collection: { name: 'Penguins' },
                        },
                    },
                }),
            ),
        )
        expect(result.current.isCollectible).toBe(true)
        expect(result.current.displayName).toBe('Penguin #42')
        expect(result.current.secondaryText).toBe('Penguins · 123')
        expect(result.current.iconShape).toBe('square')
    })

    it('exposes the deleted flag', () => {
        const { result } = renderHook(() =>
            useView(make({ peraMetadata: { isDeleted: true } })),
        )
        expect(result.current.isDeleted).toBe(true)
    })

    describe('onCopyAssetId', () => {
        beforeEach(() => {
            mockCopyToClipboard.mockClear()
        })

        it('copies the asset id when copyableAssetId is on', () => {
            const { result } = renderHook(() =>
                useView(make(), { copyableAssetId: true }),
            )

            result.current.onCopyAssetId?.()

            expect(result.current.onCopyAssetId).toBeDefined()
            expect(mockCopyToClipboard).toHaveBeenCalledWith('123')
        })

        it('is undefined when copyableAssetId is off', () => {
            const { result } = renderHook(() => useView(make()))
            expect(result.current.onCopyAssetId).toBeUndefined()
        })

        it('is undefined for ALGO even when copyableAssetId is on', () => {
            const { result } = renderHook(() =>
                useView(
                    make({ assetId: '0', name: 'Algo', unitName: 'ALGO' }),
                    {
                        copyableAssetId: true,
                    },
                ),
            )
            expect(result.current.onCopyAssetId).toBeUndefined()
        })
    })

    describe('a native coin on an EVM chain', () => {
        beforeEach(() => {
            registerEthereumChain()
        })

        afterEach(() => {
            restoreAlgorandOnlyChains()
        })

        const eth = make({ assetId: 'native', name: 'Ether', unitName: 'ETH' })

        it("reads as the chain's native coin, with the bare unit as its subtitle", () => {
            const { result } = renderHook(() =>
                useView(eth, { chainId: 'ethereum' }),
            )
            expect(result.current.isNativeAsset).toBe(true)
            expect(result.current.displayName).toBe('Ether')
            expect(result.current.secondaryText).toBe('ETH')
            expect(result.current.verificationIcon).toBe('assets/trusted')
        })

        it('offers no copy of its id even when copyableAssetId is on', () => {
            const { result } = renderHook(() =>
                useView(eth, { chainId: 'ethereum', copyableAssetId: true }),
            )
            expect(result.current.onCopyAssetId).toBeUndefined()
        })

        it('treats the Algorand native id as a token', () => {
            const token = make({ assetId: '0', name: 'Zero', unitName: 'ZRO' })
            const { result } = renderHook(() =>
                useView(token, { chainId: 'ethereum', copyableAssetId: true }),
            )
            expect(result.current.isNativeAsset).toBe(false)
            expect(result.current.secondaryText).toBe('ZRO · 0')
            expect(result.current.onCopyAssetId).toBeDefined()
        })
    })

    describe('an ERC-20 contract address', () => {
        const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

        beforeEach(() => {
            registerEthereumChain()
        })

        afterEach(() => {
            restoreAlgorandOnlyChains()
        })

        it('shows truncated by the chain codec in the subtitle', () => {
            const { result } = renderHook(() =>
                useView(make({ assetId: DAI, unitName: 'DAI' }), {
                    chainId: 'ethereum',
                }),
            )
            expect(result.current.secondaryText).toBe('DAI · 0x6B17...1d0F')
        })

        it('shows truncated in the fallback title of an unnamed token', () => {
            const { result } = renderHook(() =>
                useView(make({ assetId: DAI, name: undefined }), {
                    chainId: 'ethereum',
                }),
            )
            expect(result.current.displayName).toBe('Asset #0x6B17...1d0F')
        })

        it('leaves a numeric Algorand id as it is', () => {
            const { result } = renderHook(() =>
                useView(make(), { chainId: 'algorand' }),
            )
            expect(result.current.secondaryText).toBe('TST · 123')
        })

        it('leaves an id that is not an address as it is, such as an NFT token id', () => {
            const nftId = `${DAI}/1234`
            const { result } = renderHook(() =>
                useView(make({ assetId: nftId, unitName: 'APE' }), {
                    chainId: 'ethereum',
                }),
            )
            expect(result.current.secondaryText).toBe(`APE · ${nftId}`)
        })

        it('still copies the full address on long-press', () => {
            const { result } = renderHook(() =>
                useView(make({ assetId: DAI }), {
                    chainId: 'ethereum',
                    copyableAssetId: true,
                }),
            )
            result.current.onCopyAssetId?.()
            expect(mockCopyToClipboard).toHaveBeenCalledWith(DAI)
        })
    })
})
