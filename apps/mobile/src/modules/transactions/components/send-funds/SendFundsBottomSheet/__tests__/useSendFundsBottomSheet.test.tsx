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
import { renderHook } from '@testing-library/react'
import { useSendFundsBottomSheet } from '../useSendFundsBottomSheet'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'

const mockSetSelectedAsset = vi.fn()
const mockSetCanSelectAsset = vi.fn()
const mockSetOnFinished = vi.fn()
const mockReset = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountAssetBalanceQuery: vi.fn(() => ({
        data: { assetId: '123' },
    })),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

describe('useSendFundsBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectedAccount as any).mockReturnValue({
            address: 'test-address',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: true,
            setSelectedAsset: mockSetSelectedAsset,
            setCanSelectAsset: mockSetCanSelectAsset,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAsset: undefined,
        })
    })

    it('returns selectedAccount', () => {
        const { result } = renderHook(() =>
            useSendFundsBottomSheet(true, '123', mockOnClose),
        )

        expect(result.current.selectedAccount).toEqual({
            address: 'test-address',
        })
    })

    it('sets canSelectAsset to false and selects asset when visible with assetId', () => {
        renderHook(() => useSendFundsBottomSheet(true, '123', mockOnClose))

        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetSelectedAsset).toHaveBeenCalledWith({ assetId: '123' })
    })

    it('does not update store when not visible', () => {
        renderHook(() => useSendFundsBottomSheet(false, '123', mockOnClose))

        expect(mockSetSelectedAsset).not.toHaveBeenCalled()
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it('does not call setSelectedAsset if asset is already selected', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: false,
            setSelectedAsset: mockSetSelectedAsset,
            setCanSelectAsset: mockSetCanSelectAsset,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAsset: { assetId: '123' },
        })

        renderHook(() => useSendFundsBottomSheet(true, '123', mockOnClose))

        expect(mockSetSelectedAsset).not.toHaveBeenCalled()
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it('sets onFinished when visible', () => {
        renderHook(() => useSendFundsBottomSheet(true, '123', mockOnClose))

        expect(mockSetOnFinished).toHaveBeenCalled()
    })

    it('does not set onFinished when not visible', () => {
        renderHook(() => useSendFundsBottomSheet(false, '123', mockOnClose))

        expect(mockSetOnFinished).not.toHaveBeenCalled()
    })
})
