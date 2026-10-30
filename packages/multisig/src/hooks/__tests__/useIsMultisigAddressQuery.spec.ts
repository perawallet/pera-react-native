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
import {
    getIsMultisigAddressQueryKey,
    getMultisigAccountDetailQueryKey,
} from '../querykeys'
import { useIsMultisigAddressQuery } from '../useIsMultisigAddressQuery'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'sepolia' } as const

const mocks = vi.hoisted(() => ({
    checkIsMultisigAddress: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
    checkIsMultisigAddress: mocks.checkIsMultisigAddress,
}))

describe('useIsMultisigAddressQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    test('returns isMultisig=true when endpoint resolves true', async () => {
        mocks.checkIsMultisigAddress.mockResolvedValue(true)

        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    scope: ALGORAND_MAINNET,
                    address: 'ADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.data?.isMultisig).toBe(true))
    })

    test('checks the address against an Ethereum scope', async () => {
        mocks.checkIsMultisigAddress.mockResolvedValue(true)

        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    scope: ETHEREUM,
                    address: '0xADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.data?.isMultisig).toBe(true))
        expect(mocks.checkIsMultisigAddress).toHaveBeenCalledWith(
            ETHEREUM,
            '0xADDR',
        )
    })

    test('caches under its own key, not the account-detail key', async () => {
        mocks.checkIsMultisigAddress.mockResolvedValue(true)

        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    scope: ALGORAND_MAINNET,
                    address: 'ADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.data?.isMultisig).toBe(true))
        expect(
            queryClient.getQueryData(
                getIsMultisigAddressQueryKey(ALGORAND_MAINNET, 'ADDR'),
            ),
        ).toEqual({ isMultisig: true })
        expect(
            queryClient.getQueryData(
                getMultisigAccountDetailQueryKey(ALGORAND_MAINNET, 'ADDR'),
            ),
        ).toBeUndefined()
    })

    test('returns isMultisig=false when endpoint resolves false', async () => {
        mocks.checkIsMultisigAddress.mockResolvedValue(false)

        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    scope: ALGORAND_MAINNET,
                    address: 'ADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.data?.isMultisig).toBe(false))
    })

    test('does not fetch when address is empty', () => {
        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    scope: ALGORAND_MAINNET,
                    address: '',
                }),
            { wrapper },
        )

        expect(result.current.isFetching).toBe(false)
        expect(mocks.checkIsMultisigAddress).not.toHaveBeenCalled()
    })

    test('does not fetch when enabled is false', () => {
        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    scope: ALGORAND_MAINNET,
                    address: 'ADDR',
                    enabled: false,
                }),
            { wrapper },
        )

        expect(result.current.isFetching).toBe(false)
        expect(mocks.checkIsMultisigAddress).not.toHaveBeenCalled()
    })
})
