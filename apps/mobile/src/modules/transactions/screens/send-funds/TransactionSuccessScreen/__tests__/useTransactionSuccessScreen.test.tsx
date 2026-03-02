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
import { useTransactionSuccessScreen } from '../useTransactionSuccessScreen'
import { useSendFunds } from '@modules/transactions/hooks'
import { useNetwork } from '@perawallet/wallet-core-platform-extension'
import { useWebView } from '@modules/webview/hooks'

const mockOnFinished = vi.fn()
const mockPushWebView = vi.fn()
const mockRemove = vi.fn()
const mockRemoveAccountById = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()

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
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useRemoveAccountById: vi.fn(() => mockRemoveAccountById),
    useSelectedAccount: vi.fn(() => ({ id: 'account-1', address: 'ADDR1' })),
    useSelectedAccountAddress: vi.fn(() => ({
        selectedAccountAddress: 'ADDR1',
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    })),
    useAccountsStore: vi.fn(
        (selector: (state: Record<string, unknown>) => unknown) =>
            selector({
                accounts: [
                    { id: 'account-1', address: 'ADDR1' },
                    { id: 'account-2', address: 'ADDR2' },
                ],
            }),
    ),
}))

vi.mock('@perawallet/wallet-core-platform-extension', () => ({
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
            result.current.handleViewInExplorer()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://explorer.perawallet.app/tx/TX_ID_123',
            id: 'mock-uuid',
        })
    })
})
