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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// algokit-utils adds BigInt.prototype.microAlgo() at runtime; patch for tests.
;(BigInt.prototype as unknown as { microAlgo: () => bigint }).microAlgo =
    function () {
        return this as unknown as bigint
    }

const mockPayment = vi.fn()
const mockGetSuggestedParams = vi.fn()
const mockAlgokit = {
    createTransaction: { payment: mockPayment },
    getSuggestedParams: mockGetSuggestedParams,
}
const mockUseNetwork = vi.fn(() => ({ network: 'mainnet' }))
const mockUseAllAccounts = vi.fn()
const mockUseMinimumFeeConfig = vi.fn()
const mockResolveMinFeeForSender = vi.fn()

// Full replacement (not importActual): the real barrels pull in
// platform-specific storage (react-native-mmkv) that can't load under
// vitest/jsdom. `resolveMinFeeForSender`'s own rekey-chain/PQ-multiplier
// correctness is already exhaustively covered by
// packages/signing/src/pipeline/sources/__tests__/minFeeResolver.spec.ts —
// these tests verify only that this hook wires the resolver's inputs
// correctly and applies the override guard on its output.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => mockAlgokit,
    useNetwork: () => mockUseNetwork(),
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    MIN_TXN_FEE: 1000n,
    microAlgosToAlgos: (microAlgos: bigint) =>
        new Decimal(microAlgos.toString()).dividedBy(1_000_000),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    resolveMinFeeForSender: (...args: unknown[]) =>
        mockResolveMinFeeForSender(...args),
}))

import { useRekeyTransactionFeeQuery } from '../useRekeyTransactionFeeQuery'

const quantum = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'q1',
        address: 'QADDR',
        type: 'quantum',
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

const algo25 = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'a1',
        address: 'SRC',
        type: 'algo25',
        keyPairId: 'kp-algo25',
        ...overrides,
    }) as WalletAccount

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
    mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
    mockUseMinimumFeeConfig.mockReturnValue({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
    })
    mockUseAllAccounts.mockReturnValue([])
    // Default: no PQ signer in the chain, so the resolver returns the base
    // fee — matches the pre-existing (non-quantum) regression expectations.
    mockResolveMinFeeForSender.mockReturnValue(1000n)
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

    it('overrides a lower built fee with the PQ-resolved fee for a quantum sender', async () => {
        const accounts = [quantum({ address: 'SRC' })]
        mockUseAllAccounts.mockReturnValue(accounts)
        // resolveMinFeeForSender (1000n base * 3n multiplier = 3000n) exceeds
        // AlgoKit's auto-sized built fee and must win.
        mockResolveMinFeeForSender.mockReturnValue(3000n)
        mockPayment.mockResolvedValueOnce({ fee: 1000n })
        const { wrapper } = buildWrapper()

        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.feeAlgos?.toString()).toBe('0.003')
        expect(mockResolveMinFeeForSender).toHaveBeenCalledWith({
            senderAddress: 'SRC',
            accounts,
            suggestedMinFee: 1000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })
    })

    it('regression: resolves the built txn fee unchanged for an algo25 sender', async () => {
        mockUseAllAccounts.mockReturnValue([algo25()])
        mockResolveMinFeeForSender.mockReturnValue(1000n)
        mockPayment.mockResolvedValueOnce({ fee: 2000n })
        const { wrapper } = buildWrapper()

        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.feeAlgos?.toString()).toBe('0.002')
    })

    it('charges the PQ fee when the sender is currently rekeyed to a quantum auth (undo-rekey)', async () => {
        // The rekey txn is signed by SRC's CURRENT auth (QADDR, quantum) —
        // undoing a rekey-to-quantum must still pay the PQ fee. The resolver
        // itself performs the auth-chain walk (getSignerFor); here we assert
        // the hook forwards the full accounts array and applies the guard.
        const accounts = [
            algo25({ address: 'SRC', rekeyAddress: 'QADDR' }),
            quantum({ address: 'QADDR' }),
        ]
        mockUseAllAccounts.mockReturnValue(accounts)
        mockResolveMinFeeForSender.mockReturnValue(3000n)
        mockPayment.mockResolvedValueOnce({ fee: 1000n })
        const { wrapper } = buildWrapper()

        const { result } = renderHook(
            () => useRekeyTransactionFeeQuery('SRC', 'TGT'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.feeAlgos?.toString()).toBe('0.003')
        expect(mockResolveMinFeeForSender).toHaveBeenCalledWith(
            expect.objectContaining({ senderAddress: 'SRC', accounts }),
        )
    })
})
