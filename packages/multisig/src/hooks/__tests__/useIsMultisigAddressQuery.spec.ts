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
import { useIsMultisigAddressQuery } from '../useIsMultisigAddressQuery'

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
                    network: 'mainnet',
                    address: 'ADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.isMultisig).toBe(true)
    })

    test('returns isMultisig=false when endpoint resolves false', async () => {
        mocks.checkIsMultisigAddress.mockResolvedValue(false)

        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    network: 'mainnet',
                    address: 'ADDR',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.isMultisig).toBe(false)
    })

    test('does not fetch when address is empty', () => {
        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    network: 'mainnet',
                    address: '',
                }),
            { wrapper },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.checkIsMultisigAddress).not.toHaveBeenCalled()
    })

    test('does not fetch when enabled is false', () => {
        const { result } = renderHook(
            () =>
                useIsMultisigAddressQuery({
                    network: 'mainnet',
                    address: 'ADDR',
                    enabled: false,
                }),
            { wrapper },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.checkIsMultisigAddress).not.toHaveBeenCalled()
    })
})
