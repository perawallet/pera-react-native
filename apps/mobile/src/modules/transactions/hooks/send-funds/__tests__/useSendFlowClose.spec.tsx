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
import {
    isUniqueCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useSendFundsStore } from '../useSendFunds'
import { useSendFlowClose } from '../useSendFlowClose'

const { mockRequest, mockOnFinished } = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockOnFinished: vi.fn(),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
    useBottomSheetResult: vi.fn(),
}))

vi.mock('../useSendScope', () => ({
    useSendScope: () => ({ chainId: 'ethereum', networkId: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    isUniqueCollectible: vi.fn(),
}))

const ASSET = { chainId: 'ethereum', assetId: '0xabc' } as const
const RECIPIENT = '0x1f4A000000000000000000000000000000BEf6D2'

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useSendFlowClose', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useSendFundsStore.getState().reset()
        useSendFundsStore.getState().setOnFinished(mockOnFinished)
        useSendFundsStore.getState().setSelectedAsset(ASSET)
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([[ASSET.assetId, { assetId: ASSET.assetId }]]),
        } as never)
        vi.mocked(isUniqueCollectible).mockReturnValue(false)
    })

    it('closes at once when nothing was entered', () => {
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('asks before discarding an entered amount, and closes only on confirm', async () => {
        useSendFundsStore.getState().setAmount(new Decimal('0.009294'))
        const { result } = renderHook(() => useSendFlowClose())

        mockRequest.mockResolvedValueOnce(undefined)
        result.current.requestClose()
        await settle()

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'send-discard' }),
        )
        expect(mockOnFinished).not.toHaveBeenCalled()

        mockRequest.mockResolvedValueOnce(true)
        result.current.requestClose()
        await settle()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
    })

    it('asks before discarding a chosen recipient', async () => {
        useSendFundsStore.getState().setDestination(RECIPIENT)
        mockRequest.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()
        await settle()

        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it("doesn't ask over a recipient the entry point filled in", () => {
        useSendFundsStore.getState().setDestination(RECIPIENT)
        useSendFundsStore.getState().snapshotPrefilledDestination()
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('asks once the user picks a different recipient than the prefilled one', async () => {
        useSendFundsStore.getState().setDestination(RECIPIENT)
        useSendFundsStore.getState().snapshotPrefilledDestination()
        useSendFundsStore.getState().setDestination('0xOTHER')
        mockRequest.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()
        await settle()

        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it("doesn't ask over the amount of 1 that a unique collectible fills in", () => {
        vi.mocked(isUniqueCollectible).mockReturnValue(true)
        useSendFundsStore.getState().setAmount(new Decimal(1))
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('asks over digits typed on the amount screen that the amount does not hold yet', async () => {
        useSendFundsStore.getState().setHasUnsavedInput(true)
        mockRequest.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()
        await settle()

        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it('still closes when the prompt cannot be shown', async () => {
        useSendFundsStore.getState().setAmount(new Decimal(5))
        mockRequest.mockRejectedValueOnce(new Error('no sheet host'))
        const { result } = renderHook(() => useSendFlowClose())

        result.current.requestClose()
        await settle()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
    })
})
