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

// @vitest-environment jsdom
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    transferChainAdapters,
    type SpendableBalance,
    type SpendableBalanceInput,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { useSpendableBalancesQuery } from '../useSpendableBalancesQuery'

const mocks = vi.hoisted(() => ({
    getInFlightSpends: vi.fn(),
}))

vi.mock('../../in-flight', () => ({
    getInFlightSpends: mocks.getInFlightSpends,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    addressOn: (account: WalletAccount, scope: { chainId: 'algorand' }) =>
        account.chains[scope.chainId]?.address,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ACCOUNT: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'SENDER' } },
}
const NO_ADDRESS: WalletAccount = { ...ACCOUNT, chains: {} }

const spendable = (max: number): SpendableBalance => ({
    balance: new Decimal(5_000_000),
    max: new Decimal(max),
    reserved: new Decimal(100_000),
})

const inputFor = (
    assetId: string,
    account: WalletAccount = ACCOUNT,
): SpendableBalanceInput => ({
    account,
    asset: { chainId: SCOPE.chainId, assetId },
    scope: SCOPE,
    fee: new Decimal(1_000),
})

const spendableBalance = vi.fn<TransferChainAdapter['spendableBalance']>()

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

describe('useSpendableBalancesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: SCOPE.chainId,
            build: vi.fn(),
            getFeeEstimate: vi.fn(),
            spendableBalance,
        })
        spendableBalance.mockImplementation(async ({ asset }) =>
            spendable(asset.assetId === '0' ? 4_899_000 : 0),
        )
        mocks.getInFlightSpends.mockResolvedValue([])
    })

    it('answers each input in order once every read lands', async () => {
        const inputs = [inputFor('0'), inputFor('31566704')]

        const { result } = renderHook(() => useSpendableBalancesQuery(inputs), {
            wrapper: wrapper(queryClient),
        })

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([
            spendable(4_899_000),
            spendable(0),
        ])
    })

    it('settles with no inputs and skips an input with no address', () => {
        const { result: empty } = renderHook(
            () => useSpendableBalancesQuery([]),
            { wrapper: wrapper(queryClient) },
        )
        const { result: skipped } = renderHook(
            () => useSpendableBalancesQuery([inputFor('0', NO_ADDRESS)]),
            { wrapper: wrapper(queryClient) },
        )

        expect(empty.current).toEqual({ data: [], isPending: false })
        expect(skipped.current).toEqual({ data: [undefined], isPending: false })
        expect(spendableBalance).not.toHaveBeenCalled()
    })
})
