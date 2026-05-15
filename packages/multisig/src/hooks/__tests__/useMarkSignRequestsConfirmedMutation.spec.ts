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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useMarkSignRequestsConfirmedMutation } from '../useMarkSignRequestsConfirmedMutation'

const mocks = vi.hoisted(() => ({
    markSignRequestsConfirmed: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    markSignRequestsConfirmed: mocks.markSignRequestsConfirmed,
}))

describe('useMarkSignRequestsConfirmedMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    test('calls the endpoint with the network and request payload from the input', async () => {
        mocks.markSignRequestsConfirmed.mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMarkSignRequestsConfirmedMutation(),
            { wrapper },
        )

        await act(async () => {
            await result.current.markConfirmed({
                network: 'testnet',
                deviceId: 'device-1',
                signRequestIds: ['sr-1', 'sr-2'],
            })
        })

        expect(mocks.markSignRequestsConfirmed).toHaveBeenCalledWith(
            'testnet',
            {
                device_id: 'device-1',
                proposed_sign_request_ids: ['sr-1', 'sr-2'],
            },
        )
    })

    test('rejects when the endpoint rejects', async () => {
        mocks.markSignRequestsConfirmed.mockRejectedValue(new Error('500'))

        const { result } = renderHook(
            () => useMarkSignRequestsConfirmedMutation(),
            { wrapper },
        )

        await act(async () => {
            await expect(
                result.current.markConfirmed({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestIds: ['sr-1'],
                }),
            ).rejects.toThrow('500')
        })
    })

    test('reports pending state while the request is in flight', async () => {
        let resolveRequest: () => void
        mocks.markSignRequestsConfirmed.mockReturnValue(
            new Promise<void>(resolve => {
                resolveRequest = resolve
            }),
        )

        const { result } = renderHook(
            () => useMarkSignRequestsConfirmedMutation(),
            { wrapper },
        )

        act(() => {
            void result.current.markConfirmed({
                network: 'testnet',
                deviceId: 'device-1',
                signRequestIds: ['sr-1'],
            })
        })

        await waitFor(() => expect(result.current.isPending).toBe(true))

        await act(async () => {
            resolveRequest!()
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
    })
})
