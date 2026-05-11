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
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useSignRequestDetailQuery } from '../useSignRequestDetailQuery'

const mocks = vi.hoisted(() => ({
    getSignRequestDetail: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    getSignRequestDetail: mocks.getSignRequestDetail,
}))

const validAccountResponse = {
    custom_id: 'msig-1',
    creation_datetime: '2025-01-01T00:00:00Z',
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participant_addresses: ['ADDR1', 'ADDR2'],
}

const createSignRequestResponse = (
    status:
        | 'pending'
        | 'ready'
        | 'submitting'
        | 'confirmed'
        | 'failed'
        | 'expired'
        | 'declined',
) => ({
    id: 'sr-123',
    status,
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
            responses: [{ address: 'ADDR1', response: 'signed' }],
        },
    ],
})

describe('useSignRequestDetailQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
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

    test('fetches and maps sign request detail', async () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.id).toBe('sr-123')
        expect(result.current.data?.status).toBe('pending')
        expect(result.current.data?.type).toBe('async')
        expect(result.current.data?.multisigAccount.address).toBe('MSIG_ADDR')
        expect(result.current.data?.transactionLists).toHaveLength(1)
        expect(result.current.data?.createdAt).toBeInstanceOf(Date)
    })

    test('maps nested multisigAccount correctly', async () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.multisigAccount.customId).toBe('msig-1')
        expect(result.current.data?.multisigAccount.threshold).toBe(2)
        expect(
            result.current.data?.multisigAccount.participantAddresses,
        ).toEqual(['ADDR1', 'ADDR2'])
        expect(result.current.data?.multisigAccount.createdAt).toBeInstanceOf(
            Date,
        )
    })

    test('maps transactionLists correctly', async () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.transactionLists[0].id).toBe('txlist-1')
        expect(
            result.current.data?.transactionLists[0].rawTransactions,
        ).toEqual(['tx_data'])
        expect(result.current.data?.transactionLists[0].firstValidBlock).toBe(
            100,
        )
        expect(result.current.data?.transactionLists[0].lastValidBlock).toBe(
            200,
        )
        expect(
            result.current.data?.transactionLists[0].expectedExpireDatetime,
        ).toBeInstanceOf(Date)
    })

    test('calls endpoint with correct network, deviceId and signRequestId', async () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'testnet',
                    deviceId: 'device-9',
                    signRequestId: 'sr-456',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.getSignRequestDetail).toHaveBeenCalledWith(
                'testnet',
                'device-9',
                'sr-456',
            ),
        )
    })

    test('does not fetch when deviceId is empty', () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: '',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.getSignRequestDetail).not.toHaveBeenCalled()
    })

    test('returns error state when request fails', async () => {
        mocks.getSignRequestDetail.mockRejectedValue(
            new Error('Request failed'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Request failed')
    })

    test('does not fetch when enabled is false', () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                    enabled: false,
                }),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.getSignRequestDetail).not.toHaveBeenCalled()
    })

    test('does not fetch when signRequestId is empty', () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: '',
                }),
            { wrapper },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.getSignRequestDetail).not.toHaveBeenCalled()
    })

    test('fetches only once when pollWhilePending is false', async () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                    pollWhilePending: false,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.getSignRequestDetail).toHaveBeenCalledTimes(1)
    })

    test('pollWhilePending schedules a refetch while status is pending/ready, and stops after', async () => {
        mocks.getSignRequestDetail.mockResolvedValueOnce(
            createSignRequestResponse('pending'),
        )
        mocks.getSignRequestDetail.mockResolvedValueOnce(
            createSignRequestResponse('ready'),
        )
        mocks.getSignRequestDetail.mockResolvedValueOnce(
            createSignRequestResponse('confirmed'),
        )

        vi.useFakeTimers()
        try {
            const { result } = renderHook(
                () =>
                    useSignRequestDetailQuery({
                        network: 'mainnet',
                        deviceId: 'device-1',
                        signRequestId: 'sr-123',
                        pollWhilePending: true,
                    }),
                { wrapper },
            )

            await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(result.current.data?.status).toBe('pending')

            // Advance past one poll interval — triggers second fetch (ready)
            await vi.advanceTimersByTimeAsync(5000)
            await vi.waitFor(() =>
                expect(result.current.data?.status).toBe('ready'),
            )

            // Advance again — triggers third fetch (confirmed), poll should stop
            await vi.advanceTimersByTimeAsync(5000)
            await vi.waitFor(() =>
                expect(result.current.data?.status).toBe('confirmed'),
            )

            const callsAfterConfirmed =
                mocks.getSignRequestDetail.mock.calls.length
            await vi.advanceTimersByTimeAsync(10000)
            expect(mocks.getSignRequestDetail).toHaveBeenCalledTimes(
                callsAfterConfirmed,
            )
        } finally {
            vi.useRealTimers()
        }
    })

    test('handles empty transaction_lists', async () => {
        const emptyTxListResponse = {
            ...createSignRequestResponse('pending'),
            transaction_lists: [],
        }
        mocks.getSignRequestDetail.mockResolvedValue(emptyTxListResponse)

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.transactionLists).toEqual([])
    })

    test('handles fail_reason_display when present', async () => {
        const failedResponse = {
            ...createSignRequestResponse('failed'),
            fail_reason_display: 'Transaction expired',
        }
        mocks.getSignRequestDetail.mockResolvedValue(failedResponse)

        const { result } = renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.failReasonDisplay).toBe(
            'Transaction expired',
        )
    })

    test('defaults enabled to true', async () => {
        mocks.getSignRequestDetail.mockResolvedValue(
            createSignRequestResponse('pending'),
        )

        renderHook(
            () =>
                useSignRequestDetailQuery({
                    network: 'mainnet',
                    deviceId: 'device-1',
                    signRequestId: 'sr-123',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.getSignRequestDetail).toHaveBeenCalled(),
        )
    })
})
