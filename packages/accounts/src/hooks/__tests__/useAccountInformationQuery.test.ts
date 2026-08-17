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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import React from 'react'

import { useAccountInformationQuery } from '../useAccountInformationQuery'

const mockGetAccountBalance = vi.hoisted(() => vi.fn())
const mockGetAccountHoldings = vi.hoisted(() => vi.fn())

vi.mock('../../db', () => ({
    getAccountBalance: mockGetAccountBalance,
    getAccountHoldings: mockGetAccountHoldings,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    Address: {
        fromString: (addr: string) => addr,
    },
    toBigInt: (d: Decimal) => BigInt(d.toFixed(0)),
}))

describe('useAccountInformationQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    const mockAddress =
        'TESTADDRESS123456789012345678901234567890123456789012345678'

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test('reads account information from database', async () => {
        mockGetAccountBalance.mockResolvedValue({
            accountAddress: mockAddress,
            algoBalance: new Decimal(1), // 1 ALGO (whole units)
            minBalance: new Decimal(0.1), // 0.1 ALGO (whole units)
            status: 'Online',
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockResolvedValue([
            { assetId: '123', amount: new Decimal(500), isFrozen: true },
        ])

        const { result } = renderHook(
            () => useAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual({
            minBalance: 100000n,
            amount: 1000000n,
            address: mockAddress,
            status: 'Online',
            rewards: 0n,
            assets: [{ assetId: 123n, amount: 500n, isFrozen: true }],
        })

        expect(mockGetAccountBalance).toHaveBeenCalledWith({
            accountAddress: mockAddress,
            network: 'mainnet',
        })
        expect(mockGetAccountHoldings).toHaveBeenCalledWith({
            accountAddress: mockAddress,
            network: 'mainnet',
        })
    })

    test('returns defaults when account not in database', async () => {
        mockGetAccountBalance.mockResolvedValue(undefined)
        mockGetAccountHoldings.mockResolvedValue([])

        const { result } = renderHook(
            () => useAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual({
            minBalance: 0n,
            amount: 0n,
            address: mockAddress,
            status: 'Offline',
            rewards: 0n,
            assets: [],
        })
    })

    test('provides loading state initially', () => {
        mockGetAccountBalance.mockImplementation(() => new Promise(() => {}))
        mockGetAccountHoldings.mockImplementation(() => new Promise(() => {}))

        const { result } = renderHook(
            () => useAccountInformationQuery(mockAddress),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
    })

    test('uses address in query key for caching', async () => {
        const address1 = 'ADDRESS1'
        const address2 = 'ADDRESS2'

        mockGetAccountBalance.mockResolvedValue({
            accountAddress: address1,
            algoBalance: new Decimal(1), // 1 ALGO (whole units)
            minBalance: new Decimal(0.1), // 0.1 ALGO (whole units)
            status: 'Online',
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockResolvedValue([])

        const { result: result1 } = renderHook(
            () => useAccountInformationQuery(address1),
            { wrapper },
        )

        await waitFor(() => expect(result1.current.isSuccess).toBe(true))
        expect(result1.current.data?.address).toBe(address1)

        const { result: result2 } = renderHook(
            () => useAccountInformationQuery(address2),
            { wrapper },
        )

        await waitFor(() => expect(result2.current.isSuccess).toBe(true))
        expect(result2.current.data?.address).toBe(address2)

        expect(mockGetAccountBalance).toHaveBeenCalledTimes(2)
    })
})
