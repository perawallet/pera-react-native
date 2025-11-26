import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAccountBalancesQuery } from '../useAccountBalancesQuery'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import Decimal from 'decimal.js'
import type { WalletAccount } from '../../models/accounts'

// Mock dependencies
const mockV1AccountsAssetsList = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    v1AccountsAssetsList: mockV1AccountsAssetsList,
    v1AccountsAssetsListQueryKey: vi.fn(() => ['accountAssets']),
}))

const mockUsdToPreferred = vi.fn((amount: Decimal) => amount)
vi.mock('../../../services/currencies', () => ({
    useCurrencyConverter: vi.fn(() => ({
        usdToPreferred: mockUsdToPreferred,
    })),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useAccountBalances', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUsdToPreferred.mockImplementation((amount: Decimal) => amount)
    })

    it('returns empty data when no accounts provided', () => {
        const { result } = renderHook(() => useAccountBalancesQuery([]), {
            wrapper: createWrapper(),
        })

        expect(result.current.accountBalances.size).toBe(0)
        expect(result.current.isPending).toBe(false)
        expect(result.current.isFetched).toBe(false)
        expect(result.current.isRefetching).toBe(false)
        expect(result.current.isError).toBe(false)
    })

    it('fetches and aggregates balances correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockV1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000000', // 1 Algo
                    fraction_decimals: 6,
                    balance_usd_value: '1.5',
                },
                {
                    asset_id: 123,
                    amount: '100',
                    fraction_decimals: 2,
                    balance_usd_value: '2.0',
                },
            ],
        })

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData).toBeDefined()
        expect(accountData?.algoBalance).toEqual(new Decimal(2))
        expect(accountData?.fiatBalance).toEqual(new Decimal(3.5))

        expect(result.current.portfolioAlgoBalance).toEqual(new Decimal(2))
        expect(result.current.portfolioFiatBalance).toEqual(new Decimal(3.5))
    })

    it('handles loading state', () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockV1AccountsAssetsList.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        expect(result.current.isPending).toBe(true)
    })

    it('handles error state', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockV1AccountsAssetsList.mockRejectedValue(new Error('Network Error'))

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData?.isError).toBe(true)
    })
})
