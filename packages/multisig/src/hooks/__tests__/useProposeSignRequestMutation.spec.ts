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
import { useProposeSignRequestMutation } from '../useProposeSignRequestMutation'

const mocks = vi.hoisted(() => ({
    proposeSignRequest: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    proposeSignRequest: mocks.proposeSignRequest,
}))

const validAccountResponse = {
    custom_id: 'msig-1',
    creation_datetime: '2025-01-01T00:00:00Z',
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participant_addresses: ['ADDR1', 'ADDR2'],
}

const validSignRequestResponse = {
    id: 'sr-new',
    status: 'pending' as const,
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
            responses: [{ address: 'ADDR1', response: 'signed' as const }],
        },
    ],
}

describe('useProposeSignRequestMutation', () => {
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

    test('proposes sign request successfully', async () => {
        mocks.proposeSignRequest.mockResolvedValue(validSignRequestResponse)

        const { result } = renderHook(
            () => useProposeSignRequestMutation({ network: 'mainnet' }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                joint_account_address: 'MSIG_ADDR',
                proposer_address: 'ADDR1',
                type: 'async',
                raw_transaction_lists: [['tx_data']],
                responses: [
                    {
                        address: 'ADDR1',
                        response: 'signed',
                        signatures: [['sig1']],
                    },
                ],
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.id).toBe('sr-new')
        expect(result.current.data?.status).toBe('pending')
    })

    test('calls endpoint with correct network and params', async () => {
        mocks.proposeSignRequest.mockResolvedValue(validSignRequestResponse)

        const { result } = renderHook(
            () => useProposeSignRequestMutation({ network: 'testnet' }),
            { wrapper },
        )

        const params = {
            joint_account_address: 'MSIG_ADDR',
            proposer_address: 'PROPOSER',
            type: 'async',
            raw_transaction_lists: [['tx1', 'tx2']],
            responses: [
                {
                    address: 'PROPOSER',
                    response: 'signed' as const,
                    signatures: [['sig_a', 'sig_b']],
                },
            ],
        }

        await act(async () => {
            result.current.mutate(params)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mocks.proposeSignRequest).toHaveBeenCalledWith('testnet', params)
    })

    test('returns error state when request fails', async () => {
        mocks.proposeSignRequest.mockRejectedValue(new Error('Proposal failed'))

        const { result } = renderHook(
            () => useProposeSignRequestMutation({ network: 'mainnet' }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({
                joint_account_address: 'MSIG_ADDR',
                proposer_address: 'ADDR1',
                type: 'async',
                raw_transaction_lists: [['tx']],
                responses: [
                    {
                        address: 'ADDR1',
                        response: 'signed',
                        signatures: [['sig']],
                    },
                ],
            })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Proposal failed')
    })

    test('is idle before mutation is called', () => {
        const { result } = renderHook(
            () => useProposeSignRequestMutation({ network: 'mainnet' }),
            { wrapper },
        )

        expect(result.current.isIdle).toBe(true)
        expect(result.current.data).toBeUndefined()
    })

    test('can be used with mutateAsync for promise-based handling', async () => {
        mocks.proposeSignRequest.mockResolvedValue(validSignRequestResponse)

        const { result } = renderHook(
            () => useProposeSignRequestMutation({ network: 'mainnet' }),
            { wrapper },
        )

        let data
        await act(async () => {
            data = await result.current.mutateAsync({
                joint_account_address: 'MSIG_ADDR',
                proposer_address: 'ADDR1',
                type: 'async',
                raw_transaction_lists: [['tx']],
                responses: [
                    {
                        address: 'ADDR1',
                        response: 'signed',
                        signatures: [['sig']],
                    },
                ],
            })
        })

        expect(data?.id).toBe('sr-new')
    })
})
