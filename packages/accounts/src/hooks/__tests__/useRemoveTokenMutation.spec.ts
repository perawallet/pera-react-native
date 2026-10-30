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
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    addAccountToken: vi.fn(),
    removeAccountToken: vi.fn(),
    insertAssetHolding: vi.fn(),
    getAccountAddedTokens: vi.fn(),
    fetchAssetMetadata: vi.fn(),
}))

vi.mock('../../db', () => ({
    addAccountToken: mocks.addAccountToken,
    removeAccountToken: mocks.removeAccountToken,
    insertAssetHolding: mocks.insertAssetHolding,
    getAccountAddedTokens: mocks.getAccountAddedTokens,
}))

import { getAccountHeldAssetsQueryKey } from '../querykeys'
import { useRemoveTokenMutation } from '../useRemoveTokenMutation'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const VARIABLES = { accountAddress: '0xAA', scope: SCOPE, assetId: USDC }
const SOURCES = [{ address: '0xAA', scope: SCOPE }]

const setup = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    return { queryClient, wrapper }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useRemoveTokenMutation', () => {
    it('removes the token and refreshes the account reads', async () => {
        mocks.removeAccountToken.mockResolvedValue(undefined)
        const { queryClient, wrapper } = setup()
        const key = getAccountHeldAssetsQueryKey(SOURCES)
        queryClient.setQueryData(key, [])
        const { result } = renderHook(() => useRemoveTokenMutation(), {
            wrapper,
        })

        await act(() => result.current.removeToken(VARIABLES))

        expect(mocks.removeAccountToken).toHaveBeenCalledWith(VARIABLES)
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    })
})
