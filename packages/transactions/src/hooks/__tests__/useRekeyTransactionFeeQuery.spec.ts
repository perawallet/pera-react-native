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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'

// algokit-utils adds BigInt.prototype.microAlgo() at runtime; patch for tests.
;(BigInt.prototype as unknown as { microAlgo: () => bigint }).microAlgo =
    function () {
        return this as unknown as bigint
    }

const mockPayment = vi.fn()
const mockAlgokit = { createTransaction: { payment: mockPayment } }
const mockUseNetwork = vi.fn(() => ({ network: 'mainnet' }))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => mockAlgokit,
    useNetwork: () => mockUseNetwork(),
    MIN_TXN_FEE: 1000n,
    microAlgosToAlgos: (microAlgos: bigint) =>
        new Decimal(microAlgos.toString()).dividedBy(1_000_000),
}))

import { useRekeyTransactionFeeQuery } from '../useRekeyTransactionFeeQuery'

const buildWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return {
        queryClient,
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            ),
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockUseNetwork.mockReturnValue({ network: 'mainnet' })
})

describe('useRekeyTransactionFeeQuery', () => {
    it('resolves to feeAlgos derived from the built transaction fee', async () => {
        // AlgoKit returned a 2000 microAlgo fee → 0.002 ALGO.
        mockPayment.mockResolvedValueOnce({ fee: 2000n })
        const { wrapper } = buildWrapper()

        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })
        expect(result.current.feeAlgos?.toString()).toBe('0.002')
        expect(mockPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SRC',
                receiver: 'SRC',
                rekeyTo: 'TGT',
            }),
        )
    })

    it('falls back to MIN_TXN_FEE when the built transaction has no fee', async () => {
        // AlgoKit may leave `fee` undefined in some constructs; the optional
        // chain falls back to the network minimum (1000 microAlgo → 0.001 ALGO).
        mockPayment.mockResolvedValueOnce({ fee: undefined })
        const { wrapper } = buildWrapper()

        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })
        expect(result.current.feeAlgos?.toString()).toBe('0.001')
    })

    it('does not run the query when sourceAddress is empty', async () => {
        const { wrapper } = buildWrapper()
        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('', 'TGT'),
            { wrapper },
        )

        // No fetch should have been queued.
        expect(mockPayment).not.toHaveBeenCalled()
        expect(result.current.feeAlgos).toBeUndefined()
    })

    it('does not run the query when rekeyToAddress is empty', async () => {
        const { wrapper } = buildWrapper()
        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', ''),
            { wrapper },
        )

        expect(mockPayment).not.toHaveBeenCalled()
        expect(result.current.feeAlgos).toBeUndefined()
    })

    it('caches per network — a mainnet fee does not satisfy a testnet query', async () => {
        // Same QueryClient across both renders — but the network change should
        // produce a fresh fetch because network is part of the query key.
        mockPayment
            .mockResolvedValueOnce({ fee: 1000n })
            .mockResolvedValueOnce({ fee: 5000n })
        const { wrapper } = buildWrapper()

        const { result: mainnet } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )
        await waitFor(() => expect(mainnet.current.isPending).toBe(false))
        expect(mainnet.current.feeAlgos?.toString()).toBe('0.001')

        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        const { result: testnet } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )
        await waitFor(() => expect(testnet.current.isPending).toBe(false))
        expect(testnet.current.feeAlgos?.toString()).toBe('0.005')
        expect(mockPayment).toHaveBeenCalledTimes(2)
    })
})
