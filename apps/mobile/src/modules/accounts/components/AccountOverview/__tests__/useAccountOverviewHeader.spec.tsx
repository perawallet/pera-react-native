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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { Decimal } from 'decimal.js'
import { useAccountOverviewHeader } from '../useAccountOverviewHeader'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    setCapabilityOverrides,
    setChainEnabled,
} from '@test-utils/capability-overrides'
import { findNativeAsset } from '@perawallet/wallet-core-assets'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    AccountOverviewModalContext,
    type UseAccountOverviewModalResult,
} from '../AccountOverviewModalContext'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountSummaryQuery: vi.fn(() => ({
            nativeAmount: new Decimal('100'),
            portfolioNativeValue: new Decimal('100'),
            portfolioUsdValue: new Decimal('200'),
            holdingsCount: 3,
            isComplete: true,
            isPending: false,
            isError: false,
        })),
        useAccountValueTotalsQuery: vi.fn(() => ({
            accountValueTotals: new Map([
                [
                    'test-address',
                    {
                        nativeValue: new Decimal('1000'),
                        fiatValue: new Decimal('300'),
                    },
                ],
            ]),
            isPending: false,
        })),
        useAllAccounts: vi.fn(() => [{ address: 'a' }]),
        useCanSignWith: vi.fn(() => true),
    }
})

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: vi.fn((amount: Decimal) => amount),
        nativeUsdPrice: new Decimal(0),
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
    account: {
        id: 'test',
        custody: { kind: 'watch' },
        chains: { algorand: { address: 'test-address' } },
    } as WalletAccount,
    openSendFunds: vi.fn(),
    openReceiveFunds: vi.fn(),
    openReceiveFundsOn: vi.fn(),
    openAccountOptions: vi.fn(),
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AccountOverviewModalContext.Provider value={mockContextValue}>
        {children}
    </AccountOverviewModalContext.Provider>
)

const ETH_ADDRESS = `0x${'c'.repeat(40)}`

describe('useAccountOverviewHeader', () => {
    const twoChainAccount = {
        id: 'two-chains',
        custody: { kind: 'watch' },
        chains: {
            algorand: { address: 'test-address' },
            ethereum: { address: ETH_ADDRESS },
        },
    } as WalletAccount

    const mockAccount = {
        id: 'test',
        custody: { kind: 'watch' },
        chains: { algorand: { address: 'test-address' } },
    } as WalletAccount

    beforeEach(async () => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
        // Tests below override these; put the funded defaults back each time.
        const { useAccountSummaryQuery, useAccountValueTotalsQuery } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountSummaryQuery).mockReturnValue({
            nativeAmount: new Decimal('100'),
            portfolioNativeValue: new Decimal('100'),
            portfolioUsdValue: new Decimal('200'),
            holdingsCount: 3,
            isComplete: true,
            isPending: false,
            isError: false,
            isPaused: false,
        })
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue({
            accountValueTotals: new Map([
                [
                    'test-address',
                    {
                        nativeValue: new Decimal('1000'),
                        fiatValue: new Decimal('300'),
                    },
                ],
            ]),
            isPending: false,
        } as unknown as ReturnType<typeof useAccountValueTotalsQuery>)
    })

    afterEach(() => {
        act(() => useNetworkStore.getState().setMode('live'))
    })

    const twoChainTotals = async (
        algo: { nativeValue: Decimal; fiatValue: Decimal },
        eth: { nativeValue: Decimal; fiatValue: Decimal },
    ) => {
        const { useAccountValueTotalsQuery } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue({
            accountValueTotals: new Map([
                ['test-address', algo],
                [ETH_ADDRESS, eth],
            ]),
            isPending: false,
        } as unknown as ReturnType<typeof useAccountValueTotalsQuery>)
    }

    it("shows balances while the account's own chain is available", () => {
        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.availability.isAvailable).toBe(true)
    })

    it('plots balance history on a chain that has it', () => {
        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.hasBalanceHistory).toBe(true)
    })

    it('hides the chart and trend on a chain with no balance history', () => {
        registerEthereumChain()
        setCapabilityOverrides({ balanceHistory: false }, 'ethereum')
        const ethAccount = {
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: `0x${'e'.repeat(40)}` } },
        } as WalletAccount

        const { result } = renderHook(
            () => useAccountOverviewHeader(ethAccount),
            { wrapper },
        )

        expect(result.current.hasBalanceHistory).toBe(false)
    })

    it('shows the chart for an account on Ethereum alone', () => {
        registerEthereumChain()
        const ethAccount = {
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: `0x${'e'.repeat(40)}` } },
        } as WalletAccount

        const { result } = renderHook(
            () => useAccountOverviewHeader(ethAccount),
            { wrapper },
        )

        expect(result.current.hasBalanceHistory).toBe(true)
    })

    it("shows an Ethereum account's balance in ETH under its chain's name", () => {
        registerEthereumChain()
        const ethAccount = {
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: `0x${'b'.repeat(40)}` } },
        } as WalletAccount

        const { result } = renderHook(
            () => useAccountOverviewHeader(ethAccount),
            { wrapper },
        )

        expect(result.current.availability).toMatchObject({
            isAvailable: true,
            nativeAsset: { assetId: 'native', unitName: 'ETH' },
        })
        expect(result.current.chainName).toBe('Ethereum')
    })

    it('shows the notice when this build has no native asset for the chain', () => {
        vi.mocked(findNativeAsset).mockReturnValue(undefined)

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.availability).toEqual({ isAvailable: false })
        vi.mocked(findNativeAsset).mockReset()
    })

    it("swaps balances and actions for a notice when the chain's kill switch is off", () => {
        act(() => setChainEnabled('algorand', false))

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.availability).toEqual({ isAvailable: false })
        expect(result.current.chainName).toBe('Algorand')
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

    it("shows the account's fiat total across its chains", async () => {
        const { useAccountValueTotalsQuery } =
            await import('@perawallet/wallet-core-accounts')

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.portfolioPreferredValue?.toString()).toBe('300')
        expect(result.current.hasFiatTotal).toBe(true)
        expect(vi.mocked(useAccountValueTotalsQuery)).toHaveBeenCalledWith(
            [mockAccount],
            { chainId: 'algorand', networkId: 'mainnet' },
            true,
        )
    })

    it('has no fiat total when every chain the account is on is a test network', () => {
        registerEthereumChain()
        act(() => useNetworkStore.getState().setMode('developer'))

        const { result } = renderHook(
            () => useAccountOverviewHeader(twoChainAccount),
            { wrapper },
        )

        expect(result.current.hasFiatTotal).toBe(false)
    })

    it("leaves a switched-off chain's last-synced value out of the total", async () => {
        registerEthereumChain()
        await twoChainTotals(
            { nativeValue: new Decimal('1000'), fiatValue: new Decimal('300') },
            { nativeValue: new Decimal('1.5'), fiatValue: new Decimal('3000') },
        )
        act(() => setChainEnabled('ethereum', false))

        const { result } = renderHook(
            () => useAccountOverviewHeader(twoChainAccount),
            { wrapper },
        )

        expect(result.current.portfolioPreferredValue?.toString()).toBe('300')
        expect(result.current.hasBalanceHistory).toBe(true)
    })

    it('sums every listed chain into one fiat total', async () => {
        registerEthereumChain()
        await twoChainTotals(
            { nativeValue: new Decimal('1000'), fiatValue: new Decimal('300') },
            { nativeValue: new Decimal('1.5'), fiatValue: new Decimal('3000') },
        )

        const { result } = renderHook(
            () => useAccountOverviewHeader(twoChainAccount),
            { wrapper },
        )

        expect(result.current.portfolioPreferredValue?.toString()).toBe('3300')
    })

    it('sums unrounded chain values, so sub-cent parts still add up to the total', async () => {
        registerEthereumChain()
        await twoChainTotals(
            { nativeValue: new Decimal('1'), fiatValue: new Decimal('0.006') },
            { nativeValue: new Decimal('1'), fiatValue: new Decimal('0.006') },
        )

        const { result } = renderHook(
            () => useAccountOverviewHeader(twoChainAccount),
            { wrapper },
        )

        expect(result.current.portfolioPreferredValue?.toString()).toBe('0.012')
    })

    it('shows the balance, not "get started", for a lone account holding value only on another chain', async () => {
        registerEthereumChain()
        const { useAccountSummaryQuery } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountSummaryQuery).mockReturnValue({
            nativeAmount: new Decimal('0'),
            portfolioNativeValue: new Decimal('0'),
            portfolioUsdValue: new Decimal('0'),
            holdingsCount: 0,
            isComplete: true,
            isPending: false,
            isError: false,
            isPaused: false,
        })
        await twoChainTotals(
            { nativeValue: new Decimal('0'), fiatValue: new Decimal('0') },
            { nativeValue: new Decimal('1.5'), fiatValue: new Decimal('3000') },
        )

        const { result } = renderHook(
            () => useAccountOverviewHeader(twoChainAccount),
            { wrapper },
        )

        expect(result.current.hasBalance).toBe(true)
    })

    it('hides the chart once the account spans a second chain, which it would leave out', () => {
        registerEthereumChain()

        const { result } = renderHook(
            () => useAccountOverviewHeader(twoChainAccount),
            { wrapper },
        )

        expect(result.current.hasBalanceHistory).toBe(false)
        expect(result.current.hasFiatTotal).toBe(true)
    })

    it('determines hasBalance correctly when balance is greater than zero', () => {
        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.hasBalance).toBe(true)
    })

    it('hasBalance is false for a lone account with 0 native balance (shows "get started")', async () => {
        const { useAccountSummaryQuery, useAllAccounts } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountSummaryQuery).mockReturnValue({
            nativeAmount: new Decimal('0'),
            portfolioNativeValue: new Decimal('0'),
            portfolioUsdValue: new Decimal('0'),
            holdingsCount: 1,
            isComplete: true,
            isPending: false,
            isError: false,
            isPaused: false,
        })
        vi.mocked(useAllAccounts).mockReturnValue([
            { address: 'a' },
        ] as unknown as ReturnType<typeof useAllAccounts>)

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.hasBalance).toBe(false)
    })

    it('hasBalance is true for a 0-ALGO account in a multi-account wallet', async () => {
        const { useAccountSummaryQuery, useAllAccounts } =
            await import('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountSummaryQuery).mockReturnValue({
            nativeAmount: new Decimal('0'),
            portfolioNativeValue: new Decimal('0'),
            portfolioUsdValue: new Decimal('0'),
            holdingsCount: 1,
            isComplete: true,
            isPending: false,
            isError: false,
            isPaused: false,
        })
        vi.mocked(useAllAccounts).mockReturnValue([
            { address: 'a' },
            { address: 'b' },
        ] as unknown as ReturnType<typeof useAllAccounts>)

        const { result } = renderHook(
            () => useAccountOverviewHeader(mockAccount),
            { wrapper },
        )

        expect(result.current.hasBalance).toBe(true)
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

    // The scroll/pager lock used to hang off this callback; it now lives in the
    // chart's native gesture, so selection must only move the displayed point.
    it('records the selected chart point', async () => {
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
            nativeValue: new Decimal('100'),
            preferredValue: new Decimal('200'),
        }

        act(() => {
            result.current.handleChartSelectionChange(mockPoint)
        })
        expect(setSelectedPoint).toHaveBeenCalledWith(mockPoint)

        act(() => {
            result.current.handleChartSelectionChange(null)
        })
        expect(setSelectedPoint).toHaveBeenCalledWith(null)
    })
})
