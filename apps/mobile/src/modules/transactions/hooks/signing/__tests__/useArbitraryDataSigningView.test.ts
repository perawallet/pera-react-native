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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useArbitraryDataSigningView } from '../useArbitraryDataSigningView'
import {
    ArbitraryDataSignRequest,
    useSigningRequest,
} from '../../../../../../../../packages/signing/dist'
import { useToast } from '@hooks/useToast'
import { AlgorandChainId } from '@perawallet/wallet-core-walletconnect'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
}))

describe('useArbitraryDataSigningView', () => {
    const mockShowToast = vi.fn()
    const mockSignAndSend = vi.fn()
    const mockRejectRequest = vi.fn()
    const mockRequestError = vi.fn()
    const mockReject = vi.fn()

    const baseRequest: ArbitraryDataSignRequest = {
        id: 'test-id',
        type: 'arbitrary-data',
        transport: 'callback',
        data: [
            { signer: 'ADDR1', data: 'data1', chainId: AlgorandChainId.all },
        ],
        approve: vi.fn(),
        reject: mockReject,
        error: mockRequestError,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useToast as Mock).mockReturnValue({ showToast: mockShowToast })
        ;(useSigningRequest as Mock).mockReturnValue({
            signAndSendRequest: mockSignAndSend,
            rejectRequest: mockRejectRequest,
        })
    })

    describe('approveRequest', () => {
        it('should call signAndSend and show toast on success', async () => {
            mockSignAndSend.mockResolvedValue(undefined)
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockSignAndSend).toHaveBeenCalledWith(baseRequest)
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'signing.arbitrary_data_view.success_title',
                body: 'signing.arbitrary_data_view.success_body',
                type: 'success',
            })
            expect(result.current.isPending).toBe(false)
        })

        it('should handle errors from signAndSend', async () => {
            mockSignAndSend.mockRejectedValue(new Error('Sign fail'))
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockRequestError).toHaveBeenCalledWith('Error: Sign fail')
            expect(mockShowToast).not.toHaveBeenCalled()
            expect(result.current.isPending).toBe(false)
        })
    })

    describe('rejectRequest', () => {
        it('should call coreRejectRequest with the request', () => {
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            act(() => {
                result.current.rejectRequest()
            })

            expect(mockRejectRequest).toHaveBeenCalledWith(baseRequest)
        })
    })
})
