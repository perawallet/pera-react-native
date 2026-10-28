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
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { useWebView } from '@modules/webview'

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
    useSendScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({
        invalidateQueries: mockInvalidateQueries,
    })),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getChainDescriptor: vi.fn(),
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
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
        ;(getChainDescriptor as Mock).mockReturnValue({
            displayName: 'Algorand',
            protocol: { confirmsOnSubmit: true },
            explorer: {
                name: 'Pera Explorer',
                transactionUrl: (networkId: string, txId: string) =>
                    networkId === 'mainnet'
                        ? `https://explorer.perawallet.app/tx/${txId}`
                        : undefined,
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

    it("opens the send chain's explorer for the transaction", () => {
        const { result } = renderHook(() => useTransactionSuccessScreen())

        expect(getChainDescriptor).toHaveBeenCalledWith('algorand')

        act(() => {
            result.current.handleViewInExplorer?.()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://explorer.perawallet.app/tx/TX_ID_123',
            id: 'mock-uuid',
        })
    })

    it('reports an Algorand send as final, with Pera Explorer', () => {
        const { result } = renderHook(() => useTransactionSuccessScreen())

        expect(result.current).toMatchObject({
            isAwaitingConfirmation: false,
            networkName: 'Algorand',
            explorerName: 'Pera Explorer',
        })
    })

    it("reports an EVM send as awaiting confirmation, with its network's explorer", () => {
        ;(getChainDescriptor as Mock).mockReturnValue({
            displayName: 'Base',
            protocol: { confirmsOnSubmit: false },
            explorer: {
                name: 'Basescan',
                transactionUrl: (_networkId: string, txId: string) =>
                    `https://basescan.org/tx/${txId}`,
            },
        })

        const { result } = renderHook(() => useTransactionSuccessScreen())

        expect(result.current).toMatchObject({
            isAwaitingConfirmation: true,
            networkName: 'Base',
            explorerName: 'Basescan',
        })
        act(() => {
            result.current.handleViewInExplorer?.()
        })
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://basescan.org/tx/TX_ID_123',
            id: 'mock-uuid',
        })
    })

    it('offers no explorer action on a network with no explorer', () => {
        ;(getChainDescriptor as Mock).mockReturnValue({
            protocol: { confirmsOnSubmit: true },
            explorer: { transactionUrl: () => undefined },
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
