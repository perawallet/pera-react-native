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

import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useRekeyFeePreflight } from '../useRekeyFeePreflight'

const mockGetAccountBalance = vi.fn()

// The real accounts module pulls in react-native-mmkv, which cannot load here.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountBalance: (params: unknown) => mockGetAccountBalance(params),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetwork: () => ({ network: 'testnet' }),
}))

const SOURCE_ADDRESS = 'SOURCE'.padEnd(58, 'A')
const FEE_ALGOS = new Decimal('0.001')

/** Microalgo inputs; the stored row holds display units. */
const balanceRow = (algoBalance: bigint, minBalance: bigint) => ({
    algoBalance: new Decimal(algoBalance.toString()).div(1_000_000),
    minBalance: new Decimal(minBalance.toString()).div(1_000_000),
})

const renderPreflight = (feeAlgos: Decimal | undefined) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children)
    const rendered = renderHook(
        () => useRekeyFeePreflight(SOURCE_ADDRESS, feeAlgos),
        { wrapper },
    )
    const settled = () =>
        waitFor(() => {
            expect(mockGetAccountBalance).toHaveBeenCalled()
            expect(client.isFetching()).toBe(0)
        })
    return { ...rendered, settled }
}

describe('useRekeyFeePreflight', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountBalance.mockResolvedValue(undefined)
    })

    it('passes when spendable balance exactly equals the fee', async () => {
        mockGetAccountBalance.mockResolvedValue(balanceRow(101_000n, 100_000n))

        const { result, settled } = renderPreflight(FEE_ALGOS)

        await settled()
        expect(result.current.isUnderfunded).toBe(false)
    })

    it('flags underfunded when spendable is one microalgo short of the fee', async () => {
        mockGetAccountBalance.mockResolvedValue(balanceRow(100_999n, 100_000n))

        const { result } = renderPreflight(FEE_ALGOS)

        await waitFor(() => expect(result.current.isUnderfunded).toBe(true))
    })

    it('flags a zero-balance account', async () => {
        mockGetAccountBalance.mockResolvedValue(balanceRow(0n, 0n))

        const { result } = renderPreflight(FEE_ALGOS)

        await waitFor(() => expect(result.current.isUnderfunded).toBe(true))
    })

    it('does not flag while the fee is still unresolved', async () => {
        mockGetAccountBalance.mockResolvedValue(balanceRow(0n, 0n))

        const { result, settled } = renderPreflight(undefined)

        await settled()
        expect(result.current.isUnderfunded).toBe(false)
    })

    it('does not flag when the account has no balance row', async () => {
        const { result, settled } = renderPreflight(FEE_ALGOS)

        await settled()
        expect(result.current.isUnderfunded).toBe(false)
    })

    it("reads the source address's row on the active network", async () => {
        mockGetAccountBalance.mockResolvedValue(balanceRow(101_000n, 100_000n))

        renderPreflight(FEE_ALGOS)

        await waitFor(() =>
            expect(mockGetAccountBalance).toHaveBeenCalledWith({
                accountAddress: SOURCE_ADDRESS,
                scope: scopeForLegacyNetwork('testnet'),
            }),
        )
    })
})
