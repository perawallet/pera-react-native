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
import React from 'react'

import type { AccountInformation } from '@perawallet/wallet-core-chain-contract'
import { useOnChainAccountInformationQuery } from '../useOnChainAccountInformationQuery'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: () => ({ network: 'mainnet' }),
}))

const mockAddress = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'

const mockInformation = {
    address: mockAddress,
    amount: 2_000_000n,
    minBalance: 100_000n,
    status: 'Online',
    rewards: 0n,
    assets: [{ assetId: 31566704n, amount: 500_000n, isFrozen: false }],
} as unknown as AccountInformation

const fetchAccountInformation = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchAccountInformation)

describe('useOnChainAccountInformationQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test("fetches the account information through the chain's adapter", async () => {
        fetchAccountInformation().mockResolvedValue(mockInformation)

        const { result } = renderHook(
            () => useOnChainAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toBe(mockInformation)
        expect(fetchAccountInformation()).toHaveBeenCalledWith(
            mockAddress,
            MAINNET_SCOPE,
        )
    })

    test('serves the fresh cache on remount instead of refetching', async () => {
        fetchAccountInformation().mockResolvedValue(mockInformation)

        const first = renderHook(
            () => useOnChainAccountInformationQuery(mockAddress),
            { wrapper },
        )
        await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
        first.unmount()

        const second = renderHook(
            () => useOnChainAccountInformationQuery(mockAddress),
            { wrapper },
        )
        await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

        expect(fetchAccountInformation()).toHaveBeenCalledTimes(1)
    })

    test('is disabled when address is empty', () => {
        const { result } = renderHook(
            () => useOnChainAccountInformationQuery(''),
            { wrapper },
        )

        expect(result.current.isFetching).toBe(false)
        expect(result.current.isPending).toBe(true)
    })
})
