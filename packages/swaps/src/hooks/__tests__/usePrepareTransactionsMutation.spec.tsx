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
import { usePrepareTransactionsMutation } from '../usePrepareTransactionsMutation'
import { prepareTransactions } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
}))

vi.mock('../../api', () => ({
    prepareTransactions: vi.fn(),
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

describe('usePrepareTransactionsMutation', () => {
    beforeEach(() => {
        vi.mocked(prepareTransactions).mockReset()
    })

    test('passes the request and active network through to prepareTransactions', async () => {
        vi.mocked(prepareTransactions).mockResolvedValue({} as never)

        const { result } = renderHook(() => usePrepareTransactionsMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.mutateAsync({ quote: 'q' })
        })

        await waitFor(() => expect(prepareTransactions).toHaveBeenCalled())
        expect(prepareTransactions).toHaveBeenCalledWith(
            { quote: 'q' },
            'testnet',
        )
    })
})
