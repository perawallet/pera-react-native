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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { useSendFundsContent } from '../useSendFundsContent'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    isCollectible,
    isPureNft,
    useAssetsQuery,
    DEFAULT_ASSET_VALUES,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useSendFunds } from '@modules/transactions/hooks'

const mockSetSelectedAssetId = vi.fn()
const mockSetCanSelectAsset = vi.fn()
const mockSetAmount = vi.fn()
const mockSetOnFinished = vi.fn()
const mockReset = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetsQuery: vi.fn(() => ({ data: new Map() })),
        isCollectible: vi.fn(() => false),
        isPureNft: vi.fn(() => false),
    }
})

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BottomSheetIdContext.Provider value='sheet-1'>
        {children}
    </BottomSheetIdContext.Provider>
)

describe('useSendFundsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectedAccount as any).mockReturnValue({
            address: 'test-address',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: true,
            selectedAssetId: undefined,
            setSelectedAssetId: mockSetSelectedAssetId,
            setCanSelectAsset: mockSetCanSelectAsset,
            setAmount: mockSetAmount,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
        })
    })

    it('returns selectedAccount', () => {
        const { result } = renderHook(() => useSendFundsContent('123'), {
            wrapper,
        })

        expect(result.current.selectedAccount).toEqual({
            address: 'test-address',
        })
    })

    it('sets canSelectAsset to false and selects asset when assetId is provided', () => {
        renderHook(() => useSendFundsContent('123'), { wrapper })

        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetSelectedAssetId).toHaveBeenCalledWith('123')
    })

    it('does not call setSelectedAssetId if asset is already selected', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: false,
            selectedAssetId: '123',
            setSelectedAssetId: mockSetSelectedAssetId,
            setCanSelectAsset: mockSetCanSelectAsset,
            setAmount: mockSetAmount,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
        })

        renderHook(() => useSendFundsContent('123'), { wrapper })

        expect(mockSetSelectedAssetId).not.toHaveBeenCalled()
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it('sets onFinished', () => {
        renderHook(() => useSendFundsContent('123'), { wrapper })

        expect(mockSetOnFinished).toHaveBeenCalled()
    })

    it('prefills the NFT amount only once even when the effect re-runs', () => {
        vi.mocked(isCollectible).mockReturnValue(true)
        vi.mocked(isPureNft).mockReturnValue(true)
        // A fresh `asset` identity per render (as a refetch would produce) makes
        // the effect re-run; the prefill must still fire exactly once.
        vi.mocked(useAssetsQuery).mockImplementation(() => ({
            data: new Map([
                ['nft-1', { ...DEFAULT_ASSET_VALUES, assetId: 'nft-1' }],
            ]),
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        }))

        const { rerender } = renderHook(() => useSendFundsContent('nft-1'), {
            wrapper,
        })
        rerender()
        rerender()

        expect(mockSetAmount).toHaveBeenCalledTimes(1)
    })

    it('prefills again after switching to a different pure NFT', () => {
        vi.mocked(isCollectible).mockReturnValue(true)
        vi.mocked(isPureNft).mockReturnValue(true)
        const assets = new Map<string, PeraAsset>([
            ['nft-1', { ...DEFAULT_ASSET_VALUES, assetId: 'nft-1' }],
            ['nft-2', { ...DEFAULT_ASSET_VALUES, assetId: 'nft-2' }],
        ])
        vi.mocked(useAssetsQuery).mockImplementation(() => ({
            data: assets,
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        }))

        const { rerender } = renderHook(
            ({ assetId }: { assetId: string }) => useSendFundsContent(assetId),
            { wrapper, initialProps: { assetId: 'nft-1' } },
        )
        rerender({ assetId: 'nft-2' })

        expect(mockSetAmount).toHaveBeenCalledTimes(2)
    })

    it('re-prefills the same pure NFT after handleFinished clears the latch', () => {
        vi.mocked(isCollectible).mockReturnValue(true)
        vi.mocked(isPureNft).mockReturnValue(true)
        // New Map identity per render keeps the effect re-running, so the only
        // thing stopping a re-prefill is the latch — which handleFinished drops.
        vi.mocked(useAssetsQuery).mockImplementation(() => ({
            data: new Map([
                ['nft-1', { ...DEFAULT_ASSET_VALUES, assetId: 'nft-1' }],
            ]),
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        }))

        const { result, rerender } = renderHook(
            () => useSendFundsContent('nft-1'),
            { wrapper },
        )
        expect(mockSetAmount).toHaveBeenCalledTimes(1)

        act(() => {
            result.current.handleFinished()
        })
        rerender()

        expect(mockReset).toHaveBeenCalledTimes(1)
        expect(mockSetAmount).toHaveBeenCalledTimes(2)
    })
})
