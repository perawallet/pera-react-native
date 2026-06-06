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
import React from 'react'
import { Decimal } from 'decimal.js'
import { useAccountOverviewHeader } from '../useAccountOverviewHeader'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    AccountOverviewModalContext,
    UseAccountOverviewModalResult,
} from '../AccountOverviewModalContext'

const { mockOnScrollEnabledChange } = vi.hoisted(() => ({
    mockOnScrollEnabledChange: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountSummaryQuery: vi.fn(() => ({
            portfolioAlgoValue: new Decimal('100'),
            portfolioUsdValue: new Decimal('200'),
            holdingsCount: 3,
            isPending: false,
            isError: false,
        })),
        useAllAccounts: vi.fn(() => []),
        useCanSignWith: vi.fn(() => true),
    }
})

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: vi.fn((amount: Decimal) => amount),
        algoUsdPrice: new Decimal(0),
    })),
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

const mockContextValue: UseAccountOverviewModalResult = {
    account: { address: 'test-address' } as WalletAccount,
    openSendFunds: vi.fn(),
    openReceiveFunds: vi.fn(),
    openAccountOptions: vi.fn(),
    onScrollEnabledChange: mockOnScrollEnabledChange,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AccountOverviewModalContext.Provider value={mockContextValue}>
        {children}
    </AccountOverviewModalContext.Provider>
)

describe('useAccountOverviewHeader', () => {
    const mockAccount = { address: 'test-address' } as WalletAccount

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns canSign true when canSignWith returns true', () => {
        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.canSign).toBe(true)
    })

    it('returns canSign false when canSignWith returns false', async () => {
        const { useCanSignWith } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useCanSignWith).mockReturnValue(false)

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.canSign).toBe(false)
    })

    it('returns portfolio values from account balances query', () => {
        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.portfolioAlgoValue.toString()).toBe('100')
        expect(result.current.portfolioPreferredValue.toString()).toBe('200')
    })

    it('determines hasBalance correctly when balance is greater than zero', () => {
        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.hasBalance).toBe(true)
    })

    it('determines hasBalance correctly when balance is zero', async () => {
        const { useAccountSummaryQuery } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountSummaryQuery).mockReturnValue({
            portfolioAlgoValue: new Decimal('0'),
            portfolioUsdValue: new Decimal('0'),
            holdingsCount: 0,
            isPending: false,
            isError: false,
        })

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

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

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        act(() => {
            result.current.togglePrivacyMode()
        })

        expect(setPrivacyMode).toHaveBeenCalledWith(true)
    })

    it('calls onScrollEnabledChange(false) when a chart point is selected', async () => {
        const setSelectedPoint = vi.fn()
        const { useChartInteraction } =
            await import('@hooks/useChartInteraction')
        vi.mocked(useChartInteraction).mockReturnValue({
            period: 'one-week' as const,
            setPeriod: vi.fn(),
            selectedPoint: null,
            setSelectedPoint,
            clearSelection: vi.fn(),
        })

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        const mockPoint = {
            datetime: new Date(),
            algoValue: new Decimal('100'),
            preferredValue: new Decimal('200'),
            round: 12345,
        }

        act(() => {
            result.current.handleChartSelectionChange(mockPoint)
        })

        expect(setSelectedPoint).toHaveBeenCalledWith(mockPoint)
        expect(mockOnScrollEnabledChange).toHaveBeenCalledWith(false)
    })

    it('calls onScrollEnabledChange(true) when chart selection is cleared', async () => {
        const setSelectedPoint = vi.fn()
        const { useChartInteraction } =
            await import('@hooks/useChartInteraction')
        vi.mocked(useChartInteraction).mockReturnValue({
            period: 'one-week' as const,
            setPeriod: vi.fn(),
            selectedPoint: null,
            setSelectedPoint,
            clearSelection: vi.fn(),
        })

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        act(() => {
            result.current.handleChartSelectionChange(null)
        })

        expect(setSelectedPoint).toHaveBeenCalledWith(null)
        expect(mockOnScrollEnabledChange).toHaveBeenCalledWith(true)
    })
})
