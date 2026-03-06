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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useUpdateSwapStatusMutation } from '../useUpdateSwapStatusMutation'
import { updateSwapStatus } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    updateSwapStatus: vi.fn(),
}))

const mockResult = {
    status: 'completed' as const,
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

describe('swaps/useUpdateSwapStatusMutation', () => {
    beforeEach(() => {
        vi.mocked(updateSwapStatus).mockResolvedValue(mockResult)
    })

    test('calls updateSwapStatus with swapId and data', async () => {
        const { result } = renderHook(() => useUpdateSwapStatusMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.updateSwapStatus({
                swapId: '42',
                data: { status: 'completed' },
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(updateSwapStatus).toHaveBeenCalledWith(
            '42',
            { status: 'completed' },
            'mainnet',
        )
        expect(result.current.data).toEqual(mockResult)
    })

    test('sets isError on failure', async () => {
        vi.mocked(updateSwapStatus).mockRejectedValue(new Error('Server error'))

        const { result } = renderHook(() => useUpdateSwapStatusMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.updateSwapStatus({
                swapId: '42',
                data: { status: 'failed' },
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
