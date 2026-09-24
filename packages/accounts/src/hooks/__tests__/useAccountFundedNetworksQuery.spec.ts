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
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { useAccountFundedNetworksQuery } from '../useAccountFundedNetworksQuery'

const mockGetAccountFundedNetworks = vi.fn()
vi.mock('../../db', () => ({
    getAccountFundedNetworks: (...args: unknown[]) =>
        mockGetAccountFundedNetworks(...args),
}))

const mockEnsureAccountFetched = vi.fn(() => Promise.resolve())
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: (...args: unknown[]) =>
        mockEnsureAccountFetched(...(args as [])),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useAccountFundedNetworksQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('reads funding across every network, not only the selected one', async () => {
        mockGetAccountFundedNetworks.mockResolvedValue(['testnet'])

        const { result } = renderHook(
            () => useAccountFundedNetworksQuery('ADDR1'),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.isFunded).toBe(true)
        expect(result.current.fundedNetworks).toEqual(['testnet'])
        expect(mockGetAccountFundedNetworks).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
        })
        // Only the selected network can be force-fetched; the rest are whatever
        // earlier syncs persisted.
        expect(mockEnsureAccountFetched).toHaveBeenCalledWith(
            'ADDR1',
            'mainnet',
        )
    })

    it('serves from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        mockGetAccountFundedNetworks.mockResolvedValue([])

        const { result } = renderHook(
            () => useAccountFundedNetworksQuery('ADDR1'),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.isFunded).toBe(false)
    })

    it('does not query without an address', () => {
        const { result } = renderHook(
            () => useAccountFundedNetworksQuery(undefined),
            { wrapper: wrapper() },
        )

        expect(result.current.isFunded).toBe(false)
        expect(mockGetAccountFundedNetworks).not.toHaveBeenCalled()
    })
})
