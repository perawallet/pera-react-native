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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockEnqueue = vi.hoisted(() => vi.fn())
const nameService = vi.hoisted(() => ({ isEnabled: true }))

vi.mock('../../services/nfdBatchQueue', () => ({
    nfdBatchQueue: { enqueue: mockEnqueue },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: () => nameService.isEnabled,
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        reactQueryLongLivedStaleTime: 7 * 24 * 60 * 60 * 1000,
        reactQueryLongLivedGCTime: 21 * 24 * 60 * 60 * 1000,
    },
}))

import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { useNfdForAddressQuery } from '../useNfdForAddressQuery'
import { registerFakeNameServiceAdapter } from '../../__tests__/fakeNameServiceAdapter'

const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const

const VALID_ADDRESS = 'A'.repeat(58)

describe('useNfdForAddressQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        registerFakeNameServiceAdapter()
        nameService.isEnabled = true
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        mockEnqueue.mockReset().mockResolvedValue(undefined)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it.each([ALGORAND_TESTNET, ETHEREUM_SEPOLIA])(
        'returns the NFD name resolved by the batch queue for $chainId',
        async scope => {
            registerFakeNameServiceAdapter({ chainId: scope.chainId })
            mockEnqueue.mockResolvedValue({
                name: 'alice.algo',
                image: '',
                source: 'nfd',
            })

            const { result } = renderHook(
                () => useNfdForAddressQuery(scope, VALID_ADDRESS),
                { wrapper },
            )

            await waitFor(() =>
                expect(result.current.data?.at(0)?.name).toBe('alice.algo'),
            )
            expect(mockEnqueue).toHaveBeenCalledTimes(1)
            expect(mockEnqueue).toHaveBeenCalledWith(
                VALID_ADDRESS,
                toScopeKey(scope),
            )
        },
    )

    it('returns empty array when the queue resolves with null (negative cache)', async () => {
        mockEnqueue.mockResolvedValue(null)

        const { result } = renderHook(
            () => useNfdForAddressQuery(ALGORAND_TESTNET, VALID_ADDRESS),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([])
    })

    it('returns empty array when the queue resolves with undefined', async () => {
        mockEnqueue.mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useNfdForAddressQuery(ALGORAND_TESTNET, VALID_ADDRESS),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([])
    })

    it('calls enqueue synchronously inside queryFn (no awaits before it)', async () => {
        // This is the regression guard for the batching bug: if the hook
        // ever introduces an `await` before `enqueue`, microtask flushes
        // can fire between concurrent rows and the queue stops batching.
        // We assert by mounting two hooks and checking that BOTH
        // enqueue calls happen before either resolves.
        let resolveFirst!: (v: unknown) => void
        const firstPromise = new Promise(resolve => {
            resolveFirst = resolve
        })
        mockEnqueue
            .mockImplementationOnce(() => firstPromise)
            .mockImplementationOnce(() =>
                Promise.resolve({ name: 'bob.algo', image: '', source: 'nfd' }),
            )

        const ADDR_1 = 'A'.repeat(58)
        const ADDR_2 = 'B'.repeat(58)

        renderHook(() => useNfdForAddressQuery(ALGORAND_TESTNET, ADDR_1), {
            wrapper,
        })
        renderHook(() => useNfdForAddressQuery(ALGORAND_TESTNET, ADDR_2), {
            wrapper,
        })

        // Both should have enqueued before either resolves (no await gating)
        await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(2))

        resolveFirst({ name: 'alice.algo', image: '', source: 'nfd' })
    })

    it('does not query while the nameService capability is off', () => {
        nameService.isEnabled = false

        renderHook(
            () => useNfdForAddressQuery(ALGORAND_TESTNET, VALID_ADDRESS),
            { wrapper },
        )

        expect(mockEnqueue).not.toHaveBeenCalled()
    })

    it('does not query when enabled is false', () => {
        const { result } = renderHook(
            () =>
                useNfdForAddressQuery(ALGORAND_TESTNET, VALID_ADDRESS, {
                    enabled: false,
                }),
            { wrapper },
        )
        expect(mockEnqueue).not.toHaveBeenCalled()
        expect(result.current.isPending).toBe(false)
    })

    it('does not query for invalid addresses', () => {
        renderHook(
            () => useNfdForAddressQuery(ALGORAND_TESTNET, 'not-an-address'),
            { wrapper },
        )
        expect(mockEnqueue).not.toHaveBeenCalled()
    })
    it('returns one stable empty array while disabled', () => {
        const { result, rerender } = renderHook(
            () =>
                useNfdForAddressQuery(ALGORAND_TESTNET, VALID_ADDRESS, {
                    enabled: false,
                }),
            { wrapper },
        )
        const initialData = result.current.data

        rerender()

        expect(initialData).toEqual([])
        expect(result.current.data).toBe(initialData)
    })
})
