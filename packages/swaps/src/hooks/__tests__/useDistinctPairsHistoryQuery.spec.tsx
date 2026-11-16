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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useDistinctPairsHistoryQuery } from '../useDistinctPairsHistoryQuery'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { fetchDeviceSwapHistory } from '../../api'
import { routerRequest } from '../../api/router-request'
import { routerOrderItem } from '../../api/__tests__/routerFixtures'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ACCOUNT = { scope: SCOPE, address: 'ADDRESS' }

vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api')>()),
    fetchDeviceSwapHistory: vi.fn(),
}))

vi.mock('../../api/router-request', async importOriginal => ({
    ...(await importOriginal<typeof import('../../api/router-request')>()),
    routerRequest: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceIdLookup: () => (deployment: string | null) =>
        deployment ? `device-${deployment}` : null,
}))

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('swaps/useDistinctPairsHistoryQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchDeviceSwapHistory).mockReset()
        vi.mocked(routerRequest).mockReset()
    })

    test('derives the distinct pairs from the newest history page', async () => {
        vi.mocked(fetchDeviceSwapHistory).mockResolvedValue({
            results: [
                makeSwapHistoryItem({ orderId: 'a' }),
                makeSwapHistoryItem({ orderId: 'b' }),
                makeSwapHistoryItem({ orderId: 'c', status: 'failed' }),
            ],
            next: 'more',
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([ACCOUNT]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchDeviceSwapHistory).toHaveBeenCalledWith(
            {
                deviceId: 'device-live',
                accounts: ['fake-a:main:ADDRESS'],
                limit: 50,
            },
            SCOPE,
        )
        expect(result.current.data).toHaveLength(1)
        expect(result.current.data?.[0].pairKey).toBe(
            'algorand/native|algorand/31566704',
        )
    })

    test('keeps who paid each pair', async () => {
        const paidBy = { scope: SCOPE, address: 'SECOND' }
        vi.mocked(fetchDeviceSwapHistory).mockResolvedValue({
            results: [
                makeSwapHistoryItem({ orderId: 'a', sourceAccount: paidBy }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([ACCOUNT]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.data?.[0].sourceAccount).toEqual(paidBy)
    })

    test('names the accounts in batches and merges their pairs newest first', async () => {
        const accounts = Array.from({ length: 25 }, (_, index) => ({
            scope: SCOPE,
            address: `ADDR${index}`,
        }))
        vi.mocked(fetchDeviceSwapHistory)
            .mockResolvedValueOnce({
                results: [
                    makeSwapHistoryItem({
                        orderId: 'older',
                        createdAt: '2026-10-01T10:00:00Z',
                    }),
                ],
                next: null,
            })
            .mockResolvedValueOnce({
                results: [
                    makeSwapHistoryItem({
                        orderId: 'newer',
                        assetOut: makeSwapHistoryItem().assetIn,
                        assetIn: makeSwapHistoryItem().assetOut,
                        createdAt: '2026-10-02T10:00:00Z',
                    }),
                ],
                next: null,
            })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery(accounts),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.data).toHaveLength(2))
        const batches = vi
            .mocked(fetchDeviceSwapHistory)
            .mock.calls.map(([params]) => params.accounts.length)
        expect(batches).toEqual([20, 5])
        expect(result.current.data?.map(pair => pair.swapDatetime)).toEqual([
            '2026-10-02T10:00:00Z',
            '2026-10-01T10:00:00Z',
        ])
    })

    test("keeps the other batches' pairs when one fails", async () => {
        const accounts = Array.from({ length: 21 }, (_, index) => ({
            scope: SCOPE,
            address: `ADDR${index}`,
        }))
        vi.mocked(fetchDeviceSwapHistory)
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({
                results: [makeSwapHistoryItem({ orderId: 'a' })],
                next: null,
            })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery(accounts),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isError).toBe(false)
        expect(result.current.data).toHaveLength(1)
    })

    test('leaves out an account on a network the router has no id for, keeping the rest', async () => {
        const customNode = {
            scope: { chainId: 'algorand', networkId: 'custom' } as ChainScope,
            address: 'CUSTOM',
        }
        vi.mocked(fetchDeviceSwapHistory).mockResolvedValue({
            results: [makeSwapHistoryItem({ orderId: 'a' })],
            next: null,
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([customNode, ACCOUNT]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchDeviceSwapHistory).toHaveBeenCalledWith(
            expect.objectContaining({ accounts: ['fake-a:main:ADDRESS'] }),
            SCOPE,
        )
        expect(result.current.data).toHaveLength(1)
    })

    test('asks each deployment with its own device id and network', async () => {
        const testnet = {
            scope: { chainId: 'algorand', networkId: 'testnet' } as ChainScope,
            address: 'TESTNET',
        }
        vi.mocked(fetchDeviceSwapHistory).mockResolvedValue({
            results: [],
            next: null,
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([ACCOUNT, testnet]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(fetchDeviceSwapHistory).toHaveBeenCalledTimes(2))
        expect(fetchDeviceSwapHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                deviceId: 'device-live',
                accounts: ['fake-a:main:ADDRESS'],
            }),
            SCOPE,
        )
        expect(fetchDeviceSwapHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                deviceId: 'device-developer',
                accounts: ['fake-a:test:TESTNET'],
            }),
            testnet.scope,
        )
        expect(result.current.isError).toBe(false)
    })

    test('leaves out orders the wallet did not fund itself', async () => {
        vi.mocked(fetchDeviceSwapHistory).mockResolvedValue({
            results: [
                makeSwapHistoryItem({ orderId: 'a', fundingMethod: 'deposit' }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([ACCOUNT]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.data).toEqual([])
    })

    test('is disabled without an account', () => {
        renderHook(() => useDistinctPairsHistoryQuery([]), {
            wrapper: createWrapper(),
        })

        expect(fetchDeviceSwapHistory).not.toHaveBeenCalled()
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchDeviceSwapHistory).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([ACCOUNT]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
    })

    test('keeps the registered account pairs when the combined read names one the device lacks', async () => {
        const { fetchDeviceSwapHistory: actualFetch } = await vi.importActual<
            typeof import('../../api/history/endpoints')
        >('../../api/history/endpoints')
        vi.mocked(fetchDeviceSwapHistory).mockImplementation(actualFetch)
        vi.mocked(routerRequest).mockImplementation(async ({ params }) => {
            if (params?.accounts === 'fake-a:main:ADDRESS') {
                return {
                    next: null,
                    results: [routerOrderItem({ funding_method: null })],
                }
            }
            throw new PeraNetworkError('client', {
                status: 422,
                backendCode: 'account_not_on_device',
            })
        })
        const unregistered = { scope: SCOPE, address: 'UNREGISTERED' }

        const { result } = renderHook(
            () => useDistinctPairsHistoryQuery([ACCOUNT, unregistered]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isError).toBe(false)
        expect(result.current.data).toHaveLength(1)
    })
})
