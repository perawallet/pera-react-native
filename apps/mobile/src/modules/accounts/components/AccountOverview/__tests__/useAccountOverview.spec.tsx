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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import Decimal from 'decimal.js'
import { useAccountOverview } from '../useAccountOverview'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

const { mockNavigate, mockReplace } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockReplace: vi.fn(),
}))
const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        replace: mockReplace,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: vi.fn(() => ({
        portfolioAlgoValue: new Decimal('100'),
        portfolioFiatValue: new Decimal('200'),
        isPending: false,
        accountBalances: new Map(),
        isFetched: true,
        isRefetching: false,
        isError: false,
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({ preferredFiatCurrency: 'USD' })),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(() => ({
        privacyMode: false,
        setPrivacyMode: vi.fn(),
    })),
}))

vi.mock('@hooks/useChartInteraction', () => ({
    useChartInteraction: vi.fn(() => ({
        period: 'one-week' as const,
        setPeriod: vi.fn(),
        selectedPoint: null,
        setSelectedPoint: vi.fn(),
        clearSelection: vi.fn(),
    })),
}))

describe('useAccountOverview', () => {
    const mockAccount = { address: 'test-address' } as WalletAccount

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns portfolio values from account balances query', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.portfolioAlgoValue.toString()).toBe('100')
        expect(result.current.portfolioFiatValue.toString()).toBe('200')
        expect(result.current.preferredFiatCurrency).toBe('USD')
    })

    it('determines hasBalance correctly when balance is greater than zero', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.hasBalance).toBe(true)
    })

    it('determines hasBalance correctly when balance is zero', async () => {
        const { useAccountBalancesQuery } = await import(
            '@perawallet/wallet-core-accounts'
        )
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            portfolioAlgoValue: new Decimal('0'),
            portfolioFiatValue: new Decimal('0'),
            isPending: false,
            accountBalances: new Map(),
            isFetched: true,
            isRefetching: false,
            isError: false,
        })

        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.hasBalance).toBe(false)
    })

    it('toggles privacy mode when togglePrivacyMode is called', async () => {
        const setPrivacyMode = vi.fn()
        const { useSettings } = await import('@perawallet/wallet-core-settings')
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
            setPrivacyMode,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.togglePrivacyMode()
        })

        expect(setPrivacyMode).toHaveBeenCalledWith(true)
    })

    it('navigates to Swap screen when handleSwap is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.handleSwap()
        })

        expect(mockReplace).toHaveBeenCalledWith('TabBar', { screen: 'Swap' })
    })

    it('navigates to Fund screen when handleBuyAlgo is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.handleBuyAlgo()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Fund' })
    })

    it('shows not implemented toast when handleMore is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.handleMore()
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'common.not_implemented.title',
            body: 'common.not_implemented.body',
            type: 'error',
        })
    })

    it('opens send funds modal when handleOpenSendFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.isSendFundsVisible).toBe(false)

        act(() => {
            result.current.handleOpenSendFunds()
        })

        expect(result.current.isSendFundsVisible).toBe(true)
    })

    it('closes send funds modal when handleCloseSendFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.handleOpenSendFunds()
        })

        expect(result.current.isSendFundsVisible).toBe(true)

        act(() => {
            result.current.handleCloseSendFunds()
        })

        expect(result.current.isSendFundsVisible).toBe(false)
    })

    it('opens receive funds modal when handleReceive is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.isReceiveFundsVisible).toBe(false)

        act(() => {
            result.current.handleReceive()
        })

        expect(result.current.isReceiveFundsVisible).toBe(true)
    })

    it('closes receive funds modal when handleCloseReceiveFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.handleReceive()
        })

        expect(result.current.isReceiveFundsVisible).toBe(true)

        act(() => {
            result.current.handleCloseReceiveFunds()
        })

        expect(result.current.isReceiveFundsVisible).toBe(false)
    })

    it('disables scrolling when a chart point is selected', async () => {
        const setSelectedPoint = vi.fn()
        const { useChartInteraction } = await import(
            '@hooks/useChartInteraction'
        )
        vi.mocked(useChartInteraction).mockReturnValue({
            period: 'one-week' as const,
            setPeriod: vi.fn(),
            selectedPoint: null,
            setSelectedPoint,
            clearSelection: vi.fn(),
        })

        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.scrollingEnabled).toBe(true)

        const mockPoint = {
            datetime: new Date(),
            algoValue: new Decimal('100'),
            fiatValue: new Decimal('200'),
            round: 12345,
        }

        act(() => {
            result.current.handleChartSelectionChange(mockPoint)
        })

        expect(setSelectedPoint).toHaveBeenCalledWith(mockPoint)
    })

    it('enables scrolling when chart selection is cleared', async () => {
        const setSelectedPoint = vi.fn()
        const mockPoint = {
            datetime: new Date(),
            algoValue: new Decimal('100'),
            fiatValue: new Decimal('200'),
            round: 12345,
        }
        const { useChartInteraction } = await import(
            '@hooks/useChartInteraction'
        )
        vi.mocked(useChartInteraction).mockReturnValue({
            period: 'one-week' as const,
            setPeriod: vi.fn(),
            selectedPoint: mockPoint,
            setSelectedPoint,
            clearSelection: vi.fn(),
        })

        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.handleChartSelectionChange(null)
        })

        expect(setSelectedPoint).toHaveBeenCalledWith(null)
    })
})
