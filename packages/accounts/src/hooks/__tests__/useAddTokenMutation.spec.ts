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

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAssetMetadata: mocks.fetchAssetMetadata,
}))

import { useAddTokenMutation } from '../useAddTokenMutation'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const VARIABLES = { accountAddress: '0xAA', scope: SCOPE, assetId: USDC }

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

describe('useAddTokenMutation', () => {
    it('caches the metadata before recording the token and its holding', async () => {
        const order: string[] = []
        mocks.fetchAssetMetadata.mockImplementation(async () => {
            order.push('metadata')
        })
        mocks.addAccountToken.mockImplementation(async () => {
            order.push('token')
        })
        mocks.insertAssetHolding.mockImplementation(async () => {
            order.push('holding')
        })
        const { queryClient, wrapper } = setup()
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useAddTokenMutation(), {
            wrapper,
        })

        await act(() => result.current.addToken(VARIABLES))

        expect(order).toEqual(['metadata', 'token', 'holding'])
        expect(mocks.fetchAssetMetadata).toHaveBeenCalledWith(USDC, SCOPE)
        expect(invalidate).toHaveBeenCalled()
    })

    it('records nothing when the metadata read fails', async () => {
        mocks.fetchAssetMetadata.mockRejectedValue(new Error('offline'))
        const { wrapper } = setup()
        const { result } = renderHook(() => useAddTokenMutation(), {
            wrapper,
        })

        await expect(
            act(() => result.current.addToken(VARIABLES)),
        ).rejects.toThrow('offline')
        expect(mocks.addAccountToken).not.toHaveBeenCalled()
    })
})
