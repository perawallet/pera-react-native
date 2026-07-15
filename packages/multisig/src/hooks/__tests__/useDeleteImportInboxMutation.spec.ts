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

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useDeleteImportInboxMutation } from '../useDeleteImportInboxMutation'

const mocks = vi.hoisted(() => ({
    deleteImportInbox: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    deleteImportInbox: mocks.deleteImportInbox,
}))

describe('useDeleteImportInboxMutation', () => {
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

    test('deletes import inbox successfully', async () => {
        mocks.deleteImportInbox.mockResolvedValue(undefined)

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                multisigAddress: 'MSIG_ADDR',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    test('calls endpoint with correct network, deviceId and multisigAddress', async () => {
        mocks.deleteImportInbox.mockResolvedValue(undefined)

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'testnet',
                    deviceId: 'device-abc',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                multisigAddress: 'TEST_MSIG_ADDR',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.deleteImportInbox).toHaveBeenCalledWith(
            'testnet',
            'device-abc',
            'TEST_MSIG_ADDR',
        )
    })

    test('returns error state when request fails', async () => {
        mocks.deleteImportInbox.mockRejectedValue(new Error('Delete failed'))

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                multisigAddress: 'MSIG_ADDR',
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Delete failed')
    })

    test('is idle before mutation is called', () => {
        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        expect(result.current.isIdle).toBe(true)
        expect(result.current.data).toBeUndefined()
    })

    test('is pending while mutation is in progress', async () => {
        let resolvePromise: () => void
        const promise = new Promise<void>(resolve => {
            resolvePromise = resolve
        })
        mocks.deleteImportInbox.mockReturnValue(promise)

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        act(() => {
            result.current.mutate({
                multisigAddress: 'MSIG_ADDR',
            })
        })

        await waitFor(() => expect(result.current.isPending).toBe(true))

        await act(async () => {
            resolvePromise!()
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    test('can be used with mutateAsync for promise-based handling', async () => {
        mocks.deleteImportInbox.mockResolvedValue(undefined)

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        await act(async () => {
            await result.current.mutateAsync({
                multisigAddress: 'MSIG_ADDR',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    test('uses deviceId from hook params', async () => {
        mocks.deleteImportInbox.mockResolvedValue(undefined)

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'specific-device-id',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                multisigAddress: 'MSIG_ADDR',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.deleteImportInbox).toHaveBeenCalledWith(
            'mainnet',
            'specific-device-id',
            'MSIG_ADDR',
        )
    })

    test('invokes onSuccess on successful mutation', async () => {
        mocks.deleteImportInbox.mockResolvedValue(undefined)
        const onSuccess = vi.fn()

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                    onSuccess,
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({ multisigAddress: 'MSIG_ADDR' })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    test('does not invoke onSuccess when mutation fails', async () => {
        mocks.deleteImportInbox.mockRejectedValue(new Error('Delete failed'))
        const onSuccess = vi.fn()

        const { result } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-123',
                    onSuccess,
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({ multisigAddress: 'MSIG_ADDR' })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(onSuccess).not.toHaveBeenCalled()
    })

    test('works with different networks', async () => {
        mocks.deleteImportInbox.mockResolvedValue(undefined)

        const { result: mainnetResult } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'mainnet',
                    deviceId: 'device-1',
                }),
            { wrapper },
        )

        const { result: testnetResult } = renderHook(
            () =>
                useDeleteImportInboxMutation({
                    network: 'testnet',
                    deviceId: 'device-2',
                }),
            { wrapper },
        )

        await act(async () => {
            mainnetResult.current.mutate({ multisigAddress: 'ADDR1' })
        })

        await waitFor(() => expect(mainnetResult.current.isSuccess).toBe(true))

        await act(async () => {
            testnetResult.current.mutate({ multisigAddress: 'ADDR2' })
        })

        await waitFor(() => expect(testnetResult.current.isSuccess).toBe(true))

        expect(mocks.deleteImportInbox).toHaveBeenCalledWith(
            'mainnet',
            'device-1',
            'ADDR1',
        )
        expect(mocks.deleteImportInbox).toHaveBeenCalledWith(
            'testnet',
            'device-2',
            'ADDR2',
        )
    })
})
