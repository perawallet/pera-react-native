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
import { renderHook } from '@testing-library/react'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { useSendFundsContent } from '../useSendFundsContent'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'

const mockSetSelectedAssetId = vi.fn()
const mockSetCanSelectAsset = vi.fn()
const mockSetAmount = vi.fn()
const mockSetOnFinished = vi.fn()
const mockReset = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({ data: new Map() })),
    isCollectible: vi.fn(() => false),
    isPureNft: vi.fn(() => false),
}))

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
})
