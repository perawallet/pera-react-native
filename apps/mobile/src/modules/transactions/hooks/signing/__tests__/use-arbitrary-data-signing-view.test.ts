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
import { useArbitraryDataSigningView } from '../use-arbitrary-data-signing-view'
import {
    useAllAccounts,
    useArbitraryDataSigner,
} from '@perawallet/wallet-core-accounts'
import {
    ArbitraryDataSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import { useToast } from '@hooks/toast'
import { AlgorandChainId } from '@perawallet/wallet-core-walletconnect'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    useArbitraryDataSigner: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useSigningRequest: vi.fn(),
}))

vi.mock('@hooks/toast', () => ({
    __esModule: true,
    default: vi.fn(),
}))

vi.mock('@hooks/language', () => ({
    useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
}))

describe('useArbitraryDataSigningView', () => {
    const mockShowToast = vi.fn()
    const mockRemoveSignRequest = vi.fn()
    const mockSignArbitraryData = vi.fn()
    const mockApprove = vi.fn()
    const mockReject = vi.fn()
    const mockRequestError = vi.fn()

    const mockAccount = { address: 'ADDR1', name: 'Account 1' }
    const mockAccounts = [mockAccount]

    const baseRequest: ArbitraryDataSignRequest = {
        id: 'test-id',
        type: 'arbitrary-data',
        transport: 'callback',
        data: [
            { signer: 'ADDR1', data: 'data1', chainId: AlgorandChainId.all },
        ],
        approve: mockApprove,
        reject: mockReject,
        error: mockRequestError,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useToast as Mock).mockReturnValue({ showToast: mockShowToast })
        ;(useSigningRequest as Mock).mockReturnValue({
            removeSignRequest: mockRemoveSignRequest,
        })
        ;(useAllAccounts as Mock).mockReturnValue(mockAccounts)
        ;(useArbitraryDataSigner as Mock).mockReturnValue({
            signArbitraryData: mockSignArbitraryData,
        })
    })

    describe('approveRequest', () => {
        it('should show error and remove request validation fails (algod transport)', async () => {
            const request = {
                ...baseRequest,
                transport: 'algod' as 'algod' | 'callback',
            }
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(request),
            )

            await act(async () => {
                try {
                    await result.current.approveRequest()
                    fail('Expected error to be thrown')
                } catch (error) {
                    expect(error).toBeInstanceOf(Error)
                }
            })
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(request)
            expect(mockSignArbitraryData).not.toHaveBeenCalled()
        })

        it('should fail if account is not found', async () => {
            ;(useAllAccounts as Mock).mockReturnValue([])
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(baseRequest)
            expect(mockRequestError).toHaveBeenCalledWith(
                expect.stringContaining('account_not_found'),
            )
        })

        it('should fail if signature generation fails or returns empty', async () => {
            mockSignArbitraryData.mockResolvedValue([]) // Empty signature
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(baseRequest)
            expect(mockRequestError).toHaveBeenCalledWith(
                expect.stringContaining('signature_not_found'),
            )
        })

        it('should successfully sign and approve request', async () => {
            mockSignArbitraryData.mockResolvedValue(['signature_bytes'])
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockSignArbitraryData).toHaveBeenCalledWith(
                mockAccount,
                'data1',
            )
            expect(mockApprove).toHaveBeenCalledWith([
                { signer: 'ADDR1', signature: 'signature_bytes' },
            ])
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(baseRequest)
            expect(result.current.isPending).toBe(false)
        })

        it('should handle exceptions during flow', async () => {
            mockSignArbitraryData.mockRejectedValue(new Error('Sign fail'))
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(baseRequest),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockRequestError).toHaveBeenCalledWith('Error: Sign fail')
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(baseRequest)
            expect(result.current.isPending).toBe(false)
        })
    })

    describe('rejectRequest', () => {
        it('should remove request and call reject if transport is callback', () => {
            const request = {
                ...baseRequest,
                transport: 'callback' as 'algod' | 'callback',
            }
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(request),
            )

            act(() => {
                result.current.rejectRequest()
            })

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(request)
            expect(mockReject).toHaveBeenCalled()
        })

        it('should remove request but NOT call reject if transport is not callback', () => {
            const request = {
                ...baseRequest,
                transport: 'algod' as 'algod' | 'callback',
            }
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(request),
            )

            act(() => {
                result.current.rejectRequest()
            })

            expect(mockRemoveSignRequest).toHaveBeenCalledWith(request)
            expect(mockReject).not.toHaveBeenCalled()
        })
    })
})
