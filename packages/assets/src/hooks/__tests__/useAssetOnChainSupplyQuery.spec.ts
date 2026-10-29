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
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAssetOnChainSupplyQuery } from '../useAssetOnChainSupplyQuery'
import { registerFakeAssetsAdapter } from '../../__tests__/fakeAssetsChain'

const scope: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

const onChainAsset = (totalSupply: Decimal) => ({
    assetId: '123',
    decimals: 6,
    creator: { address: '' },
    totalSupply,
})

describe('useAssetOnChainSupplyQuery', () => {
    it("reads the asset's supply from the chain, in base units", async () => {
        const fetchOnChainAsset = vi
            .fn()
            .mockResolvedValue(onChainAsset(new Decimal('61234567890000000')))
        registerFakeAssetsAdapter({ fetchOnChainAsset })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(result.current.totalSupply).not.toBeNull())
        expect(result.current.totalSupply?.toFixed()).toBe('61234567890000000')
        expect(fetchOnChainAsset).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '123' },
            scope,
        )
    })

    it('makes no chain read while disabled', () => {
        const fetchOnChainAsset = vi.fn()
        registerFakeAssetsAdapter({ fetchOnChainAsset })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, false),
            { wrapper },
        )

        expect(result.current.totalSupply).toBeNull()
        expect(fetchOnChainAsset).not.toHaveBeenCalled()
    })

    it('has no supply when the chain read fails', async () => {
        const fetchOnChainAsset = vi.fn().mockRejectedValue(new Error('rpc'))
        registerFakeAssetsAdapter({ fetchOnChainAsset })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(fetchOnChainAsset).toHaveBeenCalled())
        expect(result.current.totalSupply).toBeNull()
    })
})
