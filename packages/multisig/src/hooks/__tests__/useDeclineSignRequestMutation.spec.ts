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
import { useDeclineSignRequestMutation } from '../useDeclineSignRequestMutation'
import { getSignRequestDetailQueryKey } from '../querykeys'

const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'sepolia' } as const

const mocks = vi.hoisted(() => ({
    addSignature: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    addSignature: mocks.addSignature,
}))

const validAccountResponse = {
    custom_id: 'msig-1',
    creation_datetime: '2025-01-01T00:00:00Z',
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participant_addresses: ['ADDR1', 'ADDR2'],
}

const declinedSignRequestResponse = {
    id: 'sr-123',
    status: 'declined' as const,
    type: 'async',
    creation_datetime: '2025-01-15T10:00:00Z',
    expected_expire_datetime: '2025-01-16T10:00:00Z',
    fail_reason_display: null,
    joint_account: validAccountResponse,
    transaction_lists: [
        {
            id: 'txlist-1',
            raw_transactions: ['tx_data'],
            first_valid_block: 100,
            last_valid_block: 200,
            expected_expire_datetime: '2025-01-16T10:00:00Z',
            responses: [{ address: 'ADDR1', response: 'declined' as const }],
        },
    ],
}

describe('useDeclineSignRequestMutation', () => {
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

    test('declines sign request successfully', async () => {
        mocks.addSignature.mockResolvedValue(declinedSignRequestResponse)

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                address: 'ADDR1',
                deviceId: 'device-1',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.status).toBe('declined')
    })

    test('calls addSignature endpoint with declined response', async () => {
        mocks.addSignature.mockResolvedValue(declinedSignRequestResponse)

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_TESTNET,
                    signRequestId: 'sr-456',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                address: 'DECLINER_ADDR',
                deviceId: 'device-abc',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.addSignature).toHaveBeenCalledWith(
            ALGORAND_TESTNET,
            'sr-456',
            [
                {
                    address: 'DECLINER_ADDR',
                    response: 'declined',
                    device_id: 'device-abc',
                },
            ],
        )
    })

    test('declines and invalidates the detail of an Ethereum scope', async () => {
        mocks.addSignature.mockResolvedValue(declinedSignRequestResponse)
        const queryKey = getSignRequestDetailQueryKey(ETHEREUM, 'sr-eth')
        queryClient.setQueryData(queryKey, { id: 'sr-eth', status: 'pending' })

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ETHEREUM,
                    signRequestId: 'sr-eth',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({ address: '0xA', deviceId: 'device-1' })
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.addSignature).toHaveBeenCalledWith(ETHEREUM, 'sr-eth', [
            { address: '0xA', response: 'declined', device_id: 'device-1' },
        ])
        expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true)
    })

    test('invalidates sign request detail query on success', async () => {
        mocks.addSignature.mockResolvedValue(declinedSignRequestResponse)

        const queryKey = getSignRequestDetailQueryKey(
            ALGORAND_MAINNET,
            'sr-123',
        )
        queryClient.setQueryData(queryKey, { id: 'sr-123', status: 'pending' })

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                address: 'ADDR1',
                deviceId: 'device-1',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey,
        })
    })

    test('does not invalidate query on error', async () => {
        mocks.addSignature.mockRejectedValue(new Error('Decline failed'))

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                address: 'ADDR1',
                deviceId: 'device-1',
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(invalidateSpy).not.toHaveBeenCalled()
    })

    test('returns error state when request fails', async () => {
        mocks.addSignature.mockRejectedValue(new Error('Request rejected'))

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                address: 'ADDR1',
                deviceId: 'device-1',
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Request rejected')
    })

    test('is idle before mutation is called', () => {
        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        expect(result.current.isIdle).toBe(true)
        expect(result.current.data).toBeUndefined()
    })

    test('always sends response as declined', async () => {
        mocks.addSignature.mockResolvedValue(declinedSignRequestResponse)

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                address: 'ADDR1',
                deviceId: 'device-1',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        const callArgs = mocks.addSignature.mock.calls[0]
        expect(callArgs[2][0].response).toBe('declined')
    })

    test('can be used with mutateAsync for promise-based handling', async () => {
        mocks.addSignature.mockResolvedValue(declinedSignRequestResponse)

        const { result } = renderHook(
            () =>
                useDeclineSignRequestMutation({
                    scope: ALGORAND_MAINNET,
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        let data
        await act(async () => {
            data = await result.current.mutateAsync({
                address: 'ADDR1',
                deviceId: 'device-1',
            })
        })

        expect(data?.status).toBe('declined')
    })
})
