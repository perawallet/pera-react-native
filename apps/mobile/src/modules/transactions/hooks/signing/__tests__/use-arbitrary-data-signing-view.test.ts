/*
 Copyright 2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { renderHook, act } from '@testing-library/react-native'
import { useArbitraryDataSigningView } from '../use-arbitrary-data-signing-view'
import {
    useAllAccounts,
    useArbitraryDataSigner,
} from '@perawallet/wallet-core-accounts'
import { useSigningRequest } from '@perawallet/wallet-core-blockchain'
import useToast from '@hooks/toast'

jest.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: jest.fn(),
    useArbitraryDataSigner: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-blockchain', () => ({
    useSigningRequest: jest.fn(),
}))

jest.mock('@hooks/toast', () => ({
    __esModule: true,
    default: jest.fn(),
}))

jest.mock('@hooks/language', () => ({
    useLanguage: jest.fn().mockReturnValue({ t: (key: string) => key }),
}))

describe('useArbitraryDataSigningView', () => {
    const mockShowToast = jest.fn()
    const mockRemoveSignRequest = jest.fn()
    const mockSignArbitraryData = jest.fn()
    const mockApprove = jest.fn()
    const mockReject = jest.fn()
    const mockRequestError = jest.fn()

    const mockAccount = { address: 'ADDR1', name: 'Account 1' }
    const mockAccounts = [mockAccount]

    const baseRequest: any = {
        transport: 'p2p',
        data: [{ signer: 'ADDR1', data: 'data1' }],
        approve: mockApprove,
        reject: mockReject,
        error: mockRequestError,
    }

    beforeEach(() => {
        jest.clearAllMocks()
            ; (useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast })
            ; (useSigningRequest as jest.Mock).mockReturnValue({
                removeSignRequest: mockRemoveSignRequest,
            })
            ; (useAllAccounts as jest.Mock).mockReturnValue(mockAccounts)
            ; (useArbitraryDataSigner as jest.Mock).mockReturnValue({
                signArbitraryData: mockSignArbitraryData,
            })
    })

    describe('approveRequest', () => {
        it('should show error and remove request validation fails (algod transport)', async () => {
            const request = { ...baseRequest, transport: 'algod' }
            const { result } = renderHook(() =>
                useArbitraryDataSigningView(request),
            )

            await act(async () => {
                await result.current.approveRequest()
            })

            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
            expect(mockRemoveSignRequest).toHaveBeenCalledWith(request)
            expect(mockSignArbitraryData).not.toHaveBeenCalled()
        })

        it('should fail if account is not found', async () => {
            ; (useAllAccounts as jest.Mock).mockReturnValue([])
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
            const request = { ...baseRequest, transport: 'callback' }
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
            const request = { ...baseRequest, transport: 'p2p' }
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
