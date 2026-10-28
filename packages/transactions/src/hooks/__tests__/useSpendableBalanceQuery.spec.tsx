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
    type AssetRef,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    transferChainAdapters,
    type InFlightSpend,
    type SpendableBalance,
    type SpendableBalanceInput,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { invalidateSpendableBalanceQueries } from '../querykeys'
import { useSpendableBalanceQuery } from '../useSpendableBalanceQuery'

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

const SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const ALGO: AssetRef = { chainId: SCOPE.chainId, assetId: '0' }
const ACCOUNT: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'SENDER' } },
}
const SPENDABLE: SpendableBalance = {
    balance: new Decimal(5_000_000),
    max: new Decimal(4_899_000),
    reserved: new Decimal(100_000),
}

const spendableBalance = vi.fn<TransferChainAdapter['spendableBalance']>()

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

const inputWith = (fee: number): SpendableBalanceInput => ({
    account: ACCOUNT,
    asset: ALGO,
    scope: SCOPE,
    fee: new Decimal(fee),
})

const adapterInputWith = (fee: number): SpendableBalanceInput => ({
    ...inputWith(fee),
    inFlight: [],
})

describe('useSpendableBalanceQuery', () => {
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
        spendableBalance.mockResolvedValue(SPENDABLE)
        mocks.getInFlightSpends.mockResolvedValue([])
    })

    it('waits, without reporting pending, until it has an input', () => {
        const { result } = renderHook(
            () => useSpendableBalanceQuery(undefined),
            { wrapper: wrapper(queryClient) },
        )

        expect(result.current).toEqual({ data: undefined, isPending: false })
        expect(spendableBalance).not.toHaveBeenCalled()
    })

    it("resolves the chain's spendable balance for the input", async () => {
        const { result } = renderHook(
            () => useSpendableBalanceQuery(inputWith(1_000)),
            { wrapper: wrapper(queryClient) },
        )

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.data).toEqual(SPENDABLE))
        expect(result.current.isPending).toBe(false)
        expect(spendableBalance).toHaveBeenCalledWith(adapterInputWith(1_000))
    })

    it('re-prices when the fee arrives, showing the earlier answer as pending meanwhile', async () => {
        const { result, rerender } = renderHook(
            ({ fee }: { fee: number }) =>
                useSpendableBalanceQuery(inputWith(fee)),
            { wrapper: wrapper(queryClient), initialProps: { fee: 0 } },
        )
        await waitFor(() => expect(result.current.data).toEqual(SPENDABLE))
        const repriced = { ...SPENDABLE, max: new Decimal(4_898_000) }
        let resolveRepriced: (value: SpendableBalance) => void = () => {}
        spendableBalance.mockReturnValueOnce(
            new Promise(resolve => {
                resolveRepriced = resolve
            }),
        )

        rerender({ fee: 1_000 })

        // The earlier answer is shown, but not as an answer for this fee.
        expect(result.current.data).toEqual(SPENDABLE)
        expect(result.current.isPending).toBe(true)
        resolveRepriced(repriced)
        await waitFor(() => expect(result.current.data).toEqual(repriced))
        expect(result.current.isPending).toBe(false)
        expect(spendableBalance).toHaveBeenLastCalledWith(
            adapterInputWith(1_000),
        )
    })

    it('re-reads for a second account', async () => {
        const second: WalletAccount = {
            ...ACCOUNT,
            id: 'second',
            chains: { algorand: { address: 'SECOND' } },
        }
        const { result, rerender } = renderHook(
            ({ account }: { account: WalletAccount }) =>
                useSpendableBalanceQuery({ ...inputWith(0), account }),
            {
                wrapper: wrapper(queryClient),
                initialProps: { account: ACCOUNT },
            },
        )
        await waitFor(() => expect(result.current.data).toEqual(SPENDABLE))

        rerender({ account: second })

        await waitFor(() =>
            expect(spendableBalance).toHaveBeenLastCalledWith(
                expect.objectContaining({ account: second }),
            ),
        )
    })

    it('reads nothing for an account with no address on the scope', () => {
        const { result } = renderHook(
            () =>
                useSpendableBalanceQuery({
                    ...inputWith(0),
                    account: { ...ACCOUNT, chains: {} },
                }),
            { wrapper: wrapper(queryClient) },
        )

        expect(result.current.isPending).toBe(false)
        expect(spendableBalance).not.toHaveBeenCalled()
    })

    it("passes the account's open submission attempts to the adapter", async () => {
        const inFlight: InFlightSpend[] = [
            {
                outflows: [{ assetRef: ALGO, value: new Decimal(1_000_000) }],
                maxFee: new Decimal(1_000),
            },
        ]
        mocks.getInFlightSpends.mockResolvedValue(inFlight)

        const { result } = renderHook(
            () => useSpendableBalanceQuery(inputWith(1_000)),
            { wrapper: wrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.data).toEqual(SPENDABLE))
        expect(mocks.getInFlightSpends).toHaveBeenCalledWith({
            address: 'SENDER',
            scope: SCOPE,
        })
        expect(spendableBalance).toHaveBeenCalledWith({
            ...inputWith(1_000),
            inFlight,
        })
    })

    it('re-reads the ledger when the spendable balance is invalidated', async () => {
        const { result } = renderHook(
            () => useSpendableBalanceQuery(inputWith(1_000)),
            { wrapper: wrapper(queryClient) },
        )
        await waitFor(() => expect(result.current.data).toEqual(SPENDABLE))
        const held = { ...SPENDABLE, max: new Decimal(3_899_000) }
        spendableBalance.mockResolvedValue(held)

        invalidateSpendableBalanceQueries(queryClient)

        await waitFor(() => expect(result.current.data).toEqual(held))
        expect(mocks.getInFlightSpends).toHaveBeenCalledTimes(2)
    })
})
