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

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useNftRefreshFailure } from '../useNftRefreshFailure'

const mockRefreshSources = vi.fn((_sources: unknown, _options: unknown) =>
    Promise.resolve(),
)
vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({ refreshSources: mockRefreshSources }),
}))

const source = (chainId: ChainId) => ({
    address: '0xA',
    scope: { chainId, networkId: 'mainnet' },
})
const SOURCES = [source('algorand'), source('ethereum')]

const renderFailure = (
    params: Partial<Parameters<typeof useNftRefreshFailure>[0]>,
) =>
    renderHook(() =>
        useNftRefreshFailure({
            sources: SOURCES,
            unrefreshedChainIds: new Set<ChainId>(['ethereum']),
            selectedChainId: null,
            networkRowCount: 1,
            isSearching: false,
            ...params,
        }),
    )
const failure = (params: Parameters<typeof renderFailure>[0]) =>
    renderFailure(params).result.current

describe('useNftRefreshFailure', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    it('names every failed network on All', () => {
        expect(
            failure({
                unrefreshedChainIds: new Set<ChainId>(['algorand', 'ethereum']),
            }).failedChainNames,
        ).toBe('Algorand, Ethereum')
    })

    it("names nothing on another network's chip", () => {
        expect(
            failure({ selectedChainId: 'algorand' }).failedChainNames,
        ).toBeUndefined()
    })

    it('ignores a failed network the gallery does not show', () => {
        expect(
            failure({ sources: [source('algorand')] }).failedChainNames,
        ).toBeUndefined()
    })

    it('reads a failed load only when nothing is stored and no search narrowed it', () => {
        expect(failure({ networkRowCount: 1 }).isLoadFailed).toBe(false)
        expect(failure({ networkRowCount: 0 }).isLoadFailed).toBe(true)
        expect(
            failure({ networkRowCount: 0, isSearching: true }).isLoadFailed,
        ).toBe(false)
        expect(
            failure({ networkRowCount: 0, unrefreshedChainIds: new Set() })
                .isLoadFailed,
        ).toBe(false)
    })

    it('retries only the failed networks, as a user refresh', async () => {
        const { result } = renderFailure({})

        await act(async () => {
            result.current.handleRetry()
        })

        expect(mockRefreshSources).toHaveBeenCalledWith(
            [{ addresses: ['0xA'], scope: SOURCES[1]!.scope }],
            { isUserRefresh: true },
        )
    })
})
