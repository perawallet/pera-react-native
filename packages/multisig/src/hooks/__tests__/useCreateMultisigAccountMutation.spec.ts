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
import { useCreateMultisigAccountMutation } from '../useCreateMultisigAccountMutation'

const mocks = vi.hoisted(() => ({
    createMultisigAccount: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    createMultisigAccount: mocks.createMultisigAccount,
}))

const validAccountResponse = {
    custom_id: 'msig-new',
    creation_datetime: '2025-01-15T10:30:00Z',
    address: 'NEW_MSIG_ADDR',
    version: 1,
    threshold: 2,
    participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
}

describe('useCreateMultisigAccountMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
                mutations: {
                    retry: false,
                },
            },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    test('creates multisig account successfully', async () => {
        mocks.createMultisigAccount.mockResolvedValue(validAccountResponse)

        const { result } = renderHook(
            () => useCreateMultisigAccountMutation({ network: 'mainnet' }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
                device_id: 'device-123',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.address).toBe('NEW_MSIG_ADDR')
        expect(result.current.data?.custom_id).toBe('msig-new')
    })

    test('calls endpoint with correct network and params', async () => {
        mocks.createMultisigAccount.mockResolvedValue(validAccountResponse)

        const { result } = renderHook(
            () => useCreateMultisigAccountMutation({ network: 'testnet' }),
            { wrapper },
        )

        const params = {
            version: 1,
            threshold: 3,
            participant_addresses: ['A', 'B', 'C', 'D'],
            device_id: 'device-123',
        }

        await act(async () => {
            result.current.mutate(params)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.createMultisigAccount).toHaveBeenCalledWith(
            'testnet',
            params,
        )
    })

    test('returns error state when request fails', async () => {
        mocks.createMultisigAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(
            () => useCreateMultisigAccountMutation({ network: 'mainnet' }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2'],
                device_id: 'device-123',
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Creation failed')
    })

    test('is idle before mutation is called', () => {
        const { result } = renderHook(
            () => useCreateMultisigAccountMutation({ network: 'mainnet' }),
            { wrapper },
        )

        expect(result.current.isIdle).toBe(true)
        expect(result.current.data).toBeUndefined()
    })

    test('is pending while mutation is in progress', async () => {
        let resolvePromise: (value: unknown) => void
        const promise = new Promise(resolve => {
            resolvePromise = resolve
        })
        mocks.createMultisigAccount.mockReturnValue(promise)

        const { result } = renderHook(
            () => useCreateMultisigAccountMutation({ network: 'mainnet' }),
            { wrapper },
        )

        act(() => {
            result.current.mutate({
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2'],
                device_id: 'device-123',
            })
        })

        await waitFor(() => expect(result.current.isPending).toBe(true))

        await act(async () => {
            resolvePromise!(validAccountResponse)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    test('can be used with mutateAsync for promise-based handling', async () => {
        mocks.createMultisigAccount.mockResolvedValue(validAccountResponse)

        const { result } = renderHook(
            () => useCreateMultisigAccountMutation({ network: 'mainnet' }),
            { wrapper },
        )

        let data
        await act(async () => {
            data = await result.current.mutateAsync({
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2'],
                device_id: 'device-123',
            })
        })

        expect(data?.address).toBe('NEW_MSIG_ADDR')
    })
})
