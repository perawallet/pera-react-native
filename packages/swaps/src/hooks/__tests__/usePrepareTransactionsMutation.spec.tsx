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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'
import {
    mutationDefaults,
    NoConnectionError,
} from '@perawallet/wallet-core-shared'
import { usePrepareTransactionsMutation } from '../usePrepareTransactionsMutation'
import { prepareTransactions } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
}))

vi.mock('../../api', () => ({
    prepareTransactions: vi.fn(),
}))

// Mirrors the app's real QueryProvider policy via the shared `mutationDefaults`
// (throwOnError: false, networkMode: 'always'). Packages can't import from
// apps/mobile, so we mirror the single source of truth here. Under this policy
// a failed mutation surfaces as `mutation.error` state rather than re-throwing
// during render, and offline mutations reject (fail-fast) instead of pausing.
const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { ...mutationDefaults, retry: false },
        },
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

    afterEach(() => {
        // Don't leak offline state into other tests/files.
        onlineManager.setOnline(true)
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

    test('surfaces failures as mutation.error state (throwOnError is false)', async () => {
        vi.mocked(prepareTransactions).mockRejectedValue(
            new Error('Request failed with status code 400'),
        )

        const { result } = renderHook(() => usePrepareTransactionsMutation(), {
            wrapper,
        })

        act(() => {
            result.current.mutate({ quote: 'q' })
        })

        // Reaching this assertion proves the failed mutation did not throw
        // during render (which would crash to the app-root error boundary):
        // under `throwOnError: false` the failure lands in `isError`/`error`.
        await waitFor(() => expect(result.current.isError).toBe(true))
    })

    test('fails fast when offline: rejects with NoConnectionError instead of pausing, and never reaches the transport', async () => {
        onlineManager.setOnline(false)
        // Resolve so that, if the transport were ever reached, the mutation
        // would SUCCEED — proving the assertion below (isError) can only pass
        // because `assertOnline()` threw before `prepareTransactions` ran.
        vi.mocked(prepareTransactions).mockResolvedValue({} as never)

        const { result } = renderHook(() => usePrepareTransactionsMutation(), {
            wrapper,
        })

        act(() => {
            result.current.mutate({ quote: 'q' })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(NoConnectionError)
        // Under the OLD `networkMode: 'online'` default, an offline mutation
        // would PAUSE (isPaused: true) and never settle, then silently
        // auto-resume on reconnect. `networkMode: 'always'` makes it reject
        // instead — this guards that regression.
        expect(result.current.isPaused).toBe(false)
        expect(prepareTransactions).not.toHaveBeenCalled()
    })
})
