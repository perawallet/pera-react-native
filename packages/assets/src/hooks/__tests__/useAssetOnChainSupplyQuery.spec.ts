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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { useAssetOnChainSupplyQuery } from '../useAssetOnChainSupplyQuery'
import { registerFakeAssetsAdapter } from '../../__tests__/fakeAssetsChain'

const scope: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

// The app's own default: nothing retries unless the query asks to.
const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: 0, retryDelay: 0 } },
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
        const fetchOnChainTotalSupply = vi
            .fn()
            .mockResolvedValue(new Decimal('61234567890000000'))
        registerFakeAssetsAdapter({ fetchOnChainTotalSupply })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(result.current.totalSupply).not.toBeNull())
        expect(result.current.totalSupply?.toFixed()).toBe('61234567890000000')
        expect(fetchOnChainTotalSupply).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '123' },
            scope,
        )
    })

    it("takes the full on-chain record's supply on a chain with no supply-only read", async () => {
        const fetchOnChainAsset = vi
            .fn()
            .mockResolvedValue(onChainAsset(new Decimal('5000')))
        registerFakeAssetsAdapter({ fetchOnChainAsset })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(result.current.totalSupply).not.toBeNull())
        expect(result.current.totalSupply?.toFixed()).toBe('5000')
    })

    it('makes no chain read while disabled', () => {
        const fetchOnChainTotalSupply = vi.fn()
        registerFakeAssetsAdapter({ fetchOnChainTotalSupply })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, false),
            { wrapper },
        )

        expect(result.current.totalSupply).toBeNull()
        expect(fetchOnChainTotalSupply).not.toHaveBeenCalled()
    })

    it('reads once and has no figure for a contract with no supply to report', async () => {
        const fetchOnChainTotalSupply = vi
            .fn()
            .mockResolvedValue(new Decimal(0))
        registerFakeAssetsAdapter({ fetchOnChainTotalSupply })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(result.current.totalSupply).not.toBeNull())
        expect(result.current.totalSupply?.isZero()).toBe(true)
        expect(fetchOnChainTotalSupply).toHaveBeenCalledTimes(1)
    })

    it('retries a transient failure, then answers with the supply', async () => {
        const fetchOnChainTotalSupply = vi
            .fn()
            .mockRejectedValueOnce(new PeraNetworkError('offline'))
            .mockResolvedValue(new Decimal('5000'))
        registerFakeAssetsAdapter({ fetchOnChainTotalSupply })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(result.current.totalSupply).not.toBeNull())
        expect(result.current.totalSupply?.toFixed()).toBe('5000')
        expect(fetchOnChainTotalSupply).toHaveBeenCalledTimes(2)
    })

    it('gives up after two retries of a transient failure, with no supply', async () => {
        const fetchOnChainTotalSupply = vi
            .fn()
            .mockRejectedValue(new PeraNetworkError('server', { status: 503 }))
        registerFakeAssetsAdapter({ fetchOnChainTotalSupply })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() =>
            expect(fetchOnChainTotalSupply).toHaveBeenCalledTimes(3),
        )
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(fetchOnChainTotalSupply).toHaveBeenCalledTimes(3)
        expect(result.current.totalSupply).toBeNull()
    })

    it('does not retry a failure that is not transient', async () => {
        const fetchOnChainTotalSupply = vi
            .fn()
            .mockRejectedValue(new Error('node refused the request'))
        registerFakeAssetsAdapter({ fetchOnChainTotalSupply })

        const { result } = renderHook(
            () => useAssetOnChainSupplyQuery('123', scope, true),
            { wrapper },
        )

        await waitFor(() => expect(fetchOnChainTotalSupply).toHaveBeenCalled())
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(fetchOnChainTotalSupply).toHaveBeenCalledTimes(1)
        expect(result.current.totalSupply).toBeNull()
    })
})
