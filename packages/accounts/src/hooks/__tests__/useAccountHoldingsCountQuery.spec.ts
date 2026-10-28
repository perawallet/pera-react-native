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

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { WalletAccount } from '../../models'
import { useAccountHoldingsCountQuery } from '../useAccountHoldingsCountQuery'

const mockGetAccountPortfolioTotals = vi.fn()
vi.mock('../../db', () => ({
    getAccountPortfolioTotals: (...args: unknown[]) =>
        mockGetAccountPortfolioTotals(...args),
}))

vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))

const sources = vi.hoisted(() => ({
    value: [] as {
        address: string
        scope: { chainId: string; networkId: string }
    }[],
}))
vi.mock('../useAccountHoldingSources', () => ({
    useAccountHoldingSources: () => sources.value,
}))

const ACCOUNT = { id: 'a' } as WalletAccount

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useAccountHoldingsCountQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('adds up the holdings on every chain the account is on', async () => {
        sources.value = [
            {
                address: 'ALGO',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            },
            {
                address: '0xeth',
                scope: { chainId: 'ethereum', networkId: 'mainnet' },
            },
        ]
        mockGetAccountPortfolioTotals.mockImplementation(
            async ({ accountAddress }: { accountAddress: string }) => ({
                holdingsCount: accountAddress === 'ALGO' ? 2 : 3,
            }),
        )

        const { result } = renderHook(
            () => useAccountHoldingsCountQuery(ACCOUNT),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.holdingsCount).toBe(5))
    })

    it('counts nothing for an account on no chain that is on', () => {
        sources.value = []

        const { result } = renderHook(
            () => useAccountHoldingsCountQuery(ACCOUNT),
            { wrapper: wrapper() },
        )

        expect(result.current.holdingsCount).toBe(0)
        expect(mockGetAccountPortfolioTotals).not.toHaveBeenCalled()
    })
})
