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
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
    PeraDisplayableTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import { useGroupSimulationQuery } from '../useGroupSimulationQuery'

const mockSimulate = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return { ...actual, useNetwork: () => ({ network: 'mainnet' }) }
})

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

const groupTxs = [{ id: 'top-1' }] as unknown as PeraTransaction[]
const inner = [
    { id: 'inner-1' },
    { id: 'inner-2' },
] as unknown as PeraDisplayableTransaction[]

describe('useGroupSimulationQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSimulate.mockResolvedValue(inner)
        registerFakePlannerAdapter({ simulateGroup: mockSimulate })
    })

    test('stays disabled (no simulation) when enabled is false', async () => {
        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs,
                    enabled: false,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(mockSimulate).not.toHaveBeenCalled()
        expect(result.current.data).toEqual([])
    })

    test('stays disabled when there are no group transactions', async () => {
        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs: [],
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(mockSimulate).not.toHaveBeenCalled()
    })

    test('simulates the group on the current network and returns the inner transactions', async () => {
        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs,
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockSimulate).toHaveBeenCalledWith(groupTxs, 'mainnet')
        expect(result.current.data).toBe(inner)
    })

    test('surfaces simulation failure as an error result without retrying', async () => {
        mockSimulate.mockRejectedValue(new Error('simulate failed'))

        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs,
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(mockSimulate).toHaveBeenCalledTimes(1)
        expect(result.current.data).toEqual([])
    })
})
