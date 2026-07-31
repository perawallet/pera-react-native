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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransactionSuccessScreen } from '../useTransactionSuccessScreen'
import { useSendFunds, useClaimAssets } from '@modules/transactions/hooks'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useWebView } from '@modules/webview/hooks'

const mockOnFinished = vi.fn()
const mockPushWebView = vi.fn()
const mockRemove = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: mockRemove })),
    },
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { transactionId: 'TX_ID_123' },
    }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
    useClaimAssets: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({
        invalidateQueries: mockInvalidateQueries,
    })),
}))

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    getArc59AssetRequestsQueryKey: vi.fn((address: string, network: string) => [
        'asa-inbox',
        'arc59-asset-requests',
        { address, network },
    ]),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(),
}))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: vi.fn(),
}))

vi.mock('uuid', () => ({
    v4: () => 'mock-uuid',
}))

describe('useTransactionSuccessScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useSendFunds as Mock).mockReturnValue({
            onFinished: mockOnFinished,
            isCloseAccount: false,
        })
        ;(useClaimAssets as Mock).mockReturnValue({
            onFinished: undefined,
            accountAddress: null,
        })
        ;(useNetwork as Mock).mockReturnValue({
            networkConfig: {
                explorerUrl: 'https://explorer.perawallet.app',
            },
        })
        ;(useWebView as Mock).mockReturnValue({
            pushWebView: mockPushWebView,
        })
    })

    it('should call onFinished when handleDone is called', () => {
        const { result } = renderHook(() => useTransactionSuccessScreen())

        act(() => {
            result.current.handleDone()
        })

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
    })

    it('should call pushWebView with correct URL when handleViewInExplorer is called', () => {
        const { result } = renderHook(() => useTransactionSuccessScreen())

        act(() => {
            result.current.handleViewInExplorer?.()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://explorer.perawallet.app/tx/TX_ID_123',
            id: 'mock-uuid',
        })
    })

    it('offers no explorer action on a network with no explorer', () => {
        // `custom` has explorerUrl: '' by design. Interpolating it yields the
        // schemeless relative path '/tx/TX_ID_123', which the webview would
        // resolve against nothing — so the CTA has to be absent, not broken.
        ;(useNetwork as Mock).mockReturnValue({
            networkConfig: { explorerUrl: '' },
        })

        const { result } = renderHook(() => useTransactionSuccessScreen())

        expect(result.current.handleViewInExplorer).toBeUndefined()
    })

    it('should return payment variant by default', () => {
        const { result } = renderHook(() => useTransactionSuccessScreen())

        expect(result.current.variant).toBe('payment')
    })

    it('reports the close_account variant when closing an account', () => {
        ;(useSendFunds as Mock).mockReturnValue({
            onFinished: mockOnFinished,
            isCloseAccount: true,
        })

        const { result } = renderHook(() => useTransactionSuccessScreen())

        expect(result.current.variant).toBe('close_account')
    })
})
