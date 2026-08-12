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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountOverview } from '../useAccountOverview'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

const {
    mockSetSelectedAccount,
    mockSetCanSelectAccount,
    mockBalancesPending,
    mockHistoryPending,
    mockRequestBottomSheet,
    mockRefreshAccounts,
    mockInvalidateQueries,
} = vi.hoisted(() => ({
    mockSetSelectedAccount: vi.fn(),
    mockSetCanSelectAccount: vi.fn(),
    mockBalancesPending: { value: false },
    mockHistoryPending: { value: false },
    mockRequestBottomSheet: vi.fn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_req: any) => Promise.resolve(undefined) as Promise<unknown>,
    ),
    mockRefreshAccounts: vi.fn(() => Promise.resolve()),
    mockInvalidateQueries: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({
        refreshAccounts: mockRefreshAccounts,
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../AccountOptionsContent', () => ({
    AccountOptionsContent: () => null,
}))

vi.mock(
    '@modules/transactions/components/receive-funds/ReceiveFundsContent',
    () => ({
        ReceiveFundsContent: () => null,
    }),
)

vi.mock('@modules/transactions/components/send-funds/SendFundsContent', () => ({
    SendFundsContent: () => null,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({ address: 'selected-address' })),
    useAccountSummaryQuery: vi.fn(() => ({
        isPending: mockBalancesPending.value,
    })),
    useAccountBalancesHistoryQuery: vi.fn(() => ({
        isPending: mockHistoryPending.value,
    })),
    useEnsureAccountEnriched: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(() => ({
        setSelectedAccount: mockSetSelectedAccount,
        setCanSelectAccount: mockSetCanSelectAccount,
    })),
}))

const mockAccount = { address: 'test-address' } as WalletAccount

const createDeferred = () => {
    let resolve: () => void = () => {}
    const promise = new Promise<void>(res => {
        resolve = () => res()
    })
    return { promise, resolve }
}

const renderUseAccountOverview = () =>
    renderHook(() => useAccountOverview({ account: mockAccount }))

describe('useAccountOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBalancesPending.value = false
        mockHistoryPending.value = false
        mockRequestBottomSheet.mockResolvedValue(undefined)
        mockRefreshAccounts.mockResolvedValue(undefined)
    })

    it('refreshes the viewed account through the sync service when handleRefresh is called', async () => {
        const { result } = renderUseAccountOverview()

        await act(async () => {
            result.current.handleRefresh()
        })

        expect(mockRefreshAccounts).toHaveBeenCalledWith(
            ['test-address'],
            'mainnet',
        )
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it('reports isRefreshing while the sync refresh is in flight', async () => {
        const deferred = createDeferred()
        mockRefreshAccounts.mockReturnValue(deferred.promise)
        const { result } = renderUseAccountOverview()

        expect(result.current.isRefreshing).toBe(false)

        act(() => {
            result.current.handleRefresh()
        })
        expect(result.current.isRefreshing).toBe(true)

        await act(async () => {
            deferred.resolve()
            await deferred.promise
        })
        expect(result.current.isRefreshing).toBe(false)
    })

    it('requests the send funds bottom sheet when openSendFunds is called', () => {
        const { result } = renderUseAccountOverview()

        act(() => {
            result.current.openSendFunds()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0]?.[0]
        expect(arg?.options).toEqual({
            size: 'modal',
            enablePanDownToClose: false,
            autoCreateContainer: false,
        })
    })

    it('requests the receive funds bottom sheet and sets selected account when openReceiveFunds is called', () => {
        const { result } = renderUseAccountOverview()

        act(() => {
            result.current.openReceiveFunds()
        })

        expect(mockSetCanSelectAccount).toHaveBeenCalledWith(false)
        expect(mockSetSelectedAccount).toHaveBeenCalledWith({
            address: 'selected-address',
        })
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0]?.[0]
        expect(arg?.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('requests the account options bottom sheet when openAccountOptions is called', () => {
        const { result } = renderUseAccountOverview()

        act(() => {
            result.current.openAccountOptions()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0]?.[0]
        expect(arg?.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('isLoading gates only on the balance summary (not the chart history) and is sticky', () => {
        // The chart history is a separate, visibility-gated network query and
        // must not hold the header in a skeleton.
        mockBalancesPending.value = true
        const { result, rerender } = renderUseAccountOverview()

        expect(result.current.isLoading).toBe(true)

        mockBalancesPending.value = false
        rerender()
        expect(result.current.isLoading).toBe(false)

        // Sticky: once cleared, isLoading does not flip back to true.
        mockBalancesPending.value = true
        rerender()
        expect(result.current.isLoading).toBe(false)
    })

    it('exposes a contextValue containing the account and modal openers', () => {
        const { result } = renderUseAccountOverview()

        expect(result.current.contextValue.account).toBe(mockAccount)
        expect(typeof result.current.contextValue.openSendFunds).toBe(
            'function',
        )
        expect(typeof result.current.contextValue.openReceiveFunds).toBe(
            'function',
        )
        expect(typeof result.current.contextValue.openAccountOptions).toBe(
            'function',
        )
    })
})
