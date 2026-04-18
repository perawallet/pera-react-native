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
import { useCalculatePeraFeeMutation } from '../useCalculatePeraFeeMutation'
import { calculatePeraFee } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    calculatePeraFee: vi.fn(),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
    )
}

describe('useCalculatePeraFeeMutation', () => {
    beforeEach(() => {
        vi.mocked(calculatePeraFee).mockReset()
    })

    test('forwards the request and active network to calculatePeraFee', async () => {
        vi.mocked(calculatePeraFee).mockResolvedValue({
            peraFee: '5000',
            peraFeeAssetId: 0,
        } as never)

        const { result } = renderHook(() => useCalculatePeraFeeMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.mutateAsync({
                address: 'ADDR',
                asset_in_id: 0,
                asset_out_id: 31566704,
                amount_input: '1000000',
            } as never)
        })

        await waitFor(() => expect(calculatePeraFee).toHaveBeenCalled())
        expect(calculatePeraFee).toHaveBeenCalledWith(
            expect.objectContaining({ address: 'ADDR' }),
            'mainnet',
        )
    })
})
