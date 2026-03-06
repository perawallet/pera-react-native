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
import { useCalculateSwapAmountMutation } from '../useCalculateSwapAmountMutation'
import { calculateSwapAmount } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    calculateSwapAmount: vi.fn(),
}))

const mockResult = {
    amount: '1000000',
    peraFee: '5000',
    peraFeeAssetId: 0,
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

describe('swaps/useCalculateSwapAmountMutation', () => {
    beforeEach(() => {
        vi.mocked(calculateSwapAmount).mockResolvedValue(mockResult)
    })

    test('calls calculateSwapAmount and returns result', async () => {
        const { result } = renderHook(() => useCalculateSwapAmountMutation(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.calculateSwapAmount(mockRequest)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(calculateSwapAmount).toHaveBeenCalledWith(mockRequest, 'mainnet')
        expect(result.current.data).toEqual(mockResult)
    })
})
