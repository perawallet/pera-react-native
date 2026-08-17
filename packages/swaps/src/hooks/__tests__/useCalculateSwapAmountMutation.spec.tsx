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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import React from 'react'
import { useCalculateSwapAmountMutation } from '../useCalculateSwapAmountMutation'
import { calculateSwapAmount } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const mocks = vi.hoisted(() => ({
    useDeviceID: vi.fn<() => string | null>(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: mocks.useDeviceID,
}))

vi.mock('../../api', () => ({
    calculateSwapAmount: vi.fn(),
}))

const mockResult = {
    amount: new Decimal('1000000'),
    peraFee: new Decimal('5000'),
    peraFeeAssetId: '0',
}

const mockRequest = {
    address: 'ALGO_ADDRESS',
    asset_in_id: 0,
    asset_out_id: 31566704,
    amount_input: '1000000',
}

function createWrapper() {
    const queryClient = new QueryClient()
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

// Mirrors the app's QueryProvider default (mutations.throwOnError: true).
function createThrowOnErrorWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { throwOnError: true, retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('swaps/useCalculateSwapAmountMutation', () => {
    beforeEach(() => {
        vi.mocked(calculateSwapAmount).mockResolvedValue(mockResult)
        mocks.useDeviceID.mockReturnValue('123456')
    })

    test('calls calculateSwapAmount with the registered device id and returns result', async () => {
        const { result } = renderHook(() => useCalculateSwapAmountMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.mutate(mockRequest)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(calculateSwapAmount).toHaveBeenCalledWith(
            { ...mockRequest, device: '123456' },
            'mainnet',
        )
        expect(result.current.data).toEqual(mockResult)
    })

    test('omits device entirely before the device has registered', async () => {
        mocks.useDeviceID.mockReturnValue(null)

        const { result } = renderHook(() => useCalculateSwapAmountMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.mutate(mockRequest)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        // Not `device: null` — the key must be absent from the body.
        const [sent] = vi.mocked(calculateSwapAmount).mock.lastCall!
        expect(sent).toEqual(mockRequest)
        expect('device' in sent).toBe(false)
    })

    test('flags isError without re-throwing under the global throwOnError default', async () => {
        vi.mocked(calculateSwapAmount).mockRejectedValue(
            new Error('Request failed with status code 400'),
        )

        const { result } = renderHook(() => useCalculateSwapAmountMutation(), {
            wrapper: createThrowOnErrorWrapper(),
        })

        act(() => {
            result.current.mutate(mockRequest)
        })

        // Reaching this assertion proves the failed mutation did not throw
        // during render (which would crash to the app-root error boundary).
        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
