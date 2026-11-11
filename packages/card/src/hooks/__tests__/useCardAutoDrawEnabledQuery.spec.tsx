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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    connectedFundingSourceAddress: null as string | null,
}))
vi.mock('../../store', () => ({
    useCardStore: (
        selector: (state: {
            connectedFundingSourceAddress: string | null
        }) => unknown,
    ) =>
        selector({
            connectedFundingSourceAddress: mocks.connectedFundingSourceAddress,
        }),
}))

import { registerFakeCardAdapter } from '../../__tests__/fakeCardAdapter'
import { useCardAutoDrawEnabledQuery } from '../useCardAutoDrawEnabledQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
        client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
    >
        {children}
    </QueryClientProvider>
)

describe('useCardAutoDrawEnabledQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.connectedFundingSourceAddress = 'FUNDING'
    })

    it('reads the switch for the connected funding account', async () => {
        const adapter = registerFakeCardAdapter({
            isAutoDrawEnabled: vi.fn(async () => true),
        })

        const { result } = renderHook(
            () => useCardAutoDrawEnabledQuery(SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isEnabled).toBe(true))
        expect(adapter.isAutoDrawEnabled).toHaveBeenCalledWith(SCOPE, 'FUNDING')
        expect(result.current.updatedAt).toBeGreaterThan(0)
    })

    it('stays unanswered and asks nothing without a funding account', () => {
        mocks.connectedFundingSourceAddress = null
        const adapter = registerFakeCardAdapter()

        const { result } = renderHook(
            () => useCardAutoDrawEnabledQuery(SCOPE),
            { wrapper },
        )

        expect(result.current.isEnabled).toBeUndefined()
        expect(adapter.isAutoDrawEnabled).not.toHaveBeenCalled()
    })

    it('stays unanswered when the chain read fails', async () => {
        const isAutoDrawEnabled = vi.fn(async () => {
            throw new Error('algod down')
        })
        registerFakeCardAdapter({ isAutoDrawEnabled })

        const { result } = renderHook(
            () => useCardAutoDrawEnabledQuery(SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(isAutoDrawEnabled).toHaveBeenCalled())
        expect(result.current.isEnabled).toBeUndefined()
    })
})
