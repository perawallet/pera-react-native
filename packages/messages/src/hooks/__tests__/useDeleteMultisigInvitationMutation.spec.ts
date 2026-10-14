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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    QueryClient,
    QueryClientProvider,
    useMutation,
} from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDeleteMultisigInvitationMutation } from '../useDeleteMultisigInvitationMutation'
import { invalidateAllPredicate } from '../querykeys'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'sepolia' } as const

const mocks = vi.hoisted(() => ({
    mutationFn: vi.fn(),
    received: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    useDeleteImportInboxMutation: (options: {
        scope: unknown
        deviceId: string
        onSuccess?: () => void
    }) => {
        mocks.received(options.scope, options.deviceId)
        return useMutation({
            mutationFn: (input: { multisigAddress: string }) =>
                mocks.mutationFn(input),
            onSuccess: options.onSuccess,
        })
    },
}))

describe('useDeleteMultisigInvitationMutation', () => {
    let queryClient: QueryClient
    let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('invalidates inbox queries on successful delete', async () => {
        mocks.mutationFn.mockResolvedValue(undefined)

        const { result } = renderHook(
            () =>
                useDeleteMultisigInvitationMutation({
                    scope: ALGORAND_MAINNET,
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({ multisigAddress: 'MSIG_ADDR' })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            predicate: invalidateAllPredicate,
        })
    })

    it('does not invalidate inbox queries when delete fails', async () => {
        mocks.mutationFn.mockRejectedValue(new Error('Delete failed'))

        const { result } = renderHook(
            () =>
                useDeleteMultisigInvitationMutation({
                    scope: ALGORAND_MAINNET,
                    deviceId: 'device-123',
                }),
            { wrapper },
        )

        await act(async () => {
            result.current.mutate({ multisigAddress: 'MSIG_ADDR' })
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(invalidateQueriesSpy).not.toHaveBeenCalled()
    })

    it.each([ALGORAND_MAINNET, ETHEREUM])(
        'hands the $chainId scope to the multisig mutation',
        async scope => {
            mocks.mutationFn.mockResolvedValue(undefined)

            const { result } = renderHook(
                () =>
                    useDeleteMultisigInvitationMutation({
                        scope,
                        deviceId: 'device-123',
                    }),
                { wrapper },
            )

            await act(async () => {
                result.current.mutate({ multisigAddress: 'MSIG_ADDR' })
            })
            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(mocks.received).toHaveBeenCalledWith(scope, 'device-123')
        },
    )
})
