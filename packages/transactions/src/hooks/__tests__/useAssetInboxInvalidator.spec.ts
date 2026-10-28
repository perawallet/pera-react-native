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

// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAssetInboxInvalidator } from '../useAssetInboxInvalidator'
import {
    getAssetInboxRequestsQueryKey,
    getAssetInboxSendSummaryQueryKey,
    transactionQueryKeys,
} from '../querykeys'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const seed = () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(getAssetInboxRequestsQueryKey('A', scope), [])
    queryClient.setQueryData(
        getAssetInboxSendSummaryQueryKey('R', '1', scope),
        {},
    )
    queryClient.setQueryData(transactionQueryKeys.history('A', scope), [])
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    return { queryClient, wrapper }
}

describe('useAssetInboxInvalidator', () => {
    it('invalidates only the inbox queries', () => {
        const { queryClient, wrapper } = seed()
        const { result } = renderHook(() => useAssetInboxInvalidator(), {
            wrapper,
        })

        act(() => result.current.invalidate())

        const states = Object.fromEntries(
            queryClient
                .getQueryCache()
                .getAll()
                .map(query => [query.queryKey[0], query.state.isInvalidated]),
        )
        expect(states).toEqual({ 'asa-inbox': true, transactions: false })
    })

    it('removes only the inbox queries', () => {
        const { queryClient, wrapper } = seed()
        const { result } = renderHook(() => useAssetInboxInvalidator(), {
            wrapper,
        })

        act(() => result.current.remove())

        expect(
            queryClient
                .getQueryCache()
                .getAll()
                .map(query => query.queryKey[0]),
        ).toEqual(['transactions'])
    })
})
