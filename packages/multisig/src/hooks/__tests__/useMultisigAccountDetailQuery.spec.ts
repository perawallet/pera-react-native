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
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useMultisigAccountDetailQuery } from '../useMultisigAccountDetailQuery'

const mocks = vi.hoisted(() => ({
    getMultisigAccountDetail: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    getMultisigAccountDetail: mocks.getMultisigAccountDetail,
}))

const validAccountResponse = {
    custom_id: 'msig-1',
    creation_datetime: '2025-01-15T10:30:00Z',
    address: 'MSIG_ADDR_ABC',
    version: 1,
    threshold: 2,
    participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
}

describe('useMultisigAccountDetailQuery', () => {
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

    test('fetches and maps account detail', async () => {
        mocks.getMultisigAccountDetail.mockResolvedValue(validAccountResponse)

        const { result } = renderHook(
            () =>
                useMultisigAccountDetailQuery({
                    network: 'mainnet',
                    address: 'MSIG_ADDR_ABC',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.customId).toBe('msig-1')
        expect(result.current.data?.address).toBe('MSIG_ADDR_ABC')
        expect(result.current.data?.threshold).toBe(2)
        expect(result.current.data?.participantAddresses).toEqual([
            'ADDR1',
            'ADDR2',
            'ADDR3',
        ])
        expect(result.current.data?.createdAt).toBeInstanceOf(Date)
    })

    test('calls endpoint with correct network and address', async () => {
        mocks.getMultisigAccountDetail.mockResolvedValue(validAccountResponse)

        renderHook(
            () =>
                useMultisigAccountDetailQuery({
                    network: 'testnet',
                    address: 'TEST_ADDR',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.getMultisigAccountDetail).toHaveBeenCalledWith(
                'testnet',
                'TEST_ADDR',
            ),
        )
    })

    test('returns error state when request fails', async () => {
        mocks.getMultisigAccountDetail.mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(
            () =>
                useMultisigAccountDetailQuery({
                    network: 'mainnet',
                    address: 'MSIG_ADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Network error')
    })

    test('does not fetch when enabled is false', async () => {
        mocks.getMultisigAccountDetail.mockResolvedValue(validAccountResponse)

        const { result } = renderHook(
            () =>
                useMultisigAccountDetailQuery({
                    network: 'mainnet',
                    address: 'MSIG_ADDR',
                    enabled: false,
                }),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.getMultisigAccountDetail).not.toHaveBeenCalled()
    })

    test('does not fetch when address is empty', async () => {
        mocks.getMultisigAccountDetail.mockResolvedValue(validAccountResponse)

        const { result } = renderHook(
            () =>
                useMultisigAccountDetailQuery({
                    network: 'mainnet',
                    address: '',
                }),
            { wrapper },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.getMultisigAccountDetail).not.toHaveBeenCalled()
    })

    test('defaults enabled to true when not provided', async () => {
        mocks.getMultisigAccountDetail.mockResolvedValue(validAccountResponse)

        renderHook(
            () =>
                useMultisigAccountDetailQuery({
                    network: 'mainnet',
                    address: 'MSIG_ADDR',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.getMultisigAccountDetail).toHaveBeenCalled(),
        )
    })
})
