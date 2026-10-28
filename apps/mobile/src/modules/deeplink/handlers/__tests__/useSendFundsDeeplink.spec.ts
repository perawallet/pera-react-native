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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'

const { mockRequestByType, sendFundsStore } = vi.hoisted(() => ({
    mockRequestByType: vi.fn(),
    sendFundsStore: {
        reset: vi.fn(),
        setDestination: vi.fn(),
        setNote: vi.fn(),
        setSelectedAsset: vi.fn(),
        setChainId: vi.fn(),
        setCanSelectAsset: vi.fn(),
        setAmount: vi.fn(),
        setPendingAmountBaseUnits: vi.fn(),
        setShouldContinueToConfirm: vi.fn(),
    },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: () => ({ requestByType: mockRequestByType }),
}))

vi.mock('@modules/transactions', () => ({
    useSendFundsStore: { getState: () => sendFundsStore },
}))

import { useSendFundsDeeplink } from '../useSendFundsDeeplink'

describe('useSendFundsDeeplink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('prefills the send after clearing an older prefill, then opens the sheet', () => {
        const { result } = renderHook(() => useSendFundsDeeplink())

        result.current({
            asset: { chainId: 'algorand', assetId: '0' },
            destination: 'RECEIVER',
            amount: new Decimal('1.25'),
            note: 'rent',
        })

        expect(sendFundsStore.reset).toHaveBeenCalledBefore(
            sendFundsStore.setDestination,
        )
        expect(sendFundsStore.setDestination).toHaveBeenCalledWith('RECEIVER')
        expect(sendFundsStore.setSelectedAsset).toHaveBeenCalledWith({
            chainId: 'algorand',
            assetId: '0',
        })
        expect(sendFundsStore.setAmount).toHaveBeenCalledWith(
            new Decimal('1.25'),
        )
        expect(sendFundsStore.setNote).toHaveBeenCalledWith('rent')
        expect(sendFundsStore.setShouldContinueToConfirm).not.toHaveBeenCalled()
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { asset: { chainId: 'algorand', assetId: '0' } },
            expect.any(Object),
        )
    })

    it("opens on the link's network when no asset names it", () => {
        const { result } = renderHook(() => useSendFundsDeeplink())

        result.current({ chainId: 'algorand', destination: 'RECEIVER' })

        expect(sendFundsStore.setChainId).toHaveBeenCalledWith('algorand')
        expect(sendFundsStore.setSelectedAsset).not.toHaveBeenCalled()
        expect(sendFundsStore.setCanSelectAsset).not.toHaveBeenCalled()
    })

    it('leaves the network to the user when the link names none', () => {
        const { result } = renderHook(() => useSendFundsDeeplink())

        result.current({ destination: 'RECEIVER' })

        expect(sendFundsStore.setChainId).not.toHaveBeenCalled()
    })

    it('stores a base-units amount as digits for the input step to convert', () => {
        const { result } = renderHook(() => useSendFundsDeeplink())

        result.current({
            asset: { chainId: 'algorand', assetId: '31566704' },
            destination: 'RECEIVER',
            amountBaseUnits: new Decimal('18446744073709551616'),
        })

        expect(
            sendFundsStore.setPendingAmountBaseUnits,
        ).toHaveBeenCalledExactlyOnceWith('18446744073709551616')
        expect(sendFundsStore.setAmount).not.toHaveBeenCalled()
    })

    it('asks the amount step to continue to confirmation for an already-confirmed send', () => {
        const { result } = renderHook(() => useSendFundsDeeplink())

        result.current({
            asset: { chainId: 'algorand', assetId: '0' },
            destination: 'RECEIVER',
            amount: new Decimal('1'),
            shouldContinueToConfirm: true,
        })

        expect(sendFundsStore.setShouldContinueToConfirm).toHaveBeenCalledWith(
            true,
        )
    })
})
