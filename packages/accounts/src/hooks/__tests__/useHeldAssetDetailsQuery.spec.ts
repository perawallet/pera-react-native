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
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    getAccountHoldingsLite: vi.fn(),
    getAccountCollectiblesLite: vi.fn(),
    getAssetsByIds: vi.fn(),
}))

vi.mock('../../db', () => ({
    getAccountHoldingsLite: mocks.getAccountHoldingsLite,
    getAccountCollectiblesLite: mocks.getAccountCollectiblesLite,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    getAssetsByIds: mocks.getAssetsByIds,
}))

import { useHeldAssetDetailsQuery } from '../useHeldAssetDetailsQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
        QueryClientProvider,
        {
            client: new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
        },
        children,
    )

beforeEach(() => {
    vi.resetAllMocks()
    mocks.getAssetsByIds.mockResolvedValue([])
})

describe('useHeldAssetDetailsQuery', () => {
    it('looks up fungible holdings with a balance once across accounts', async () => {
        mocks.getAccountHoldingsLite
            .mockResolvedValueOnce([{ assetId: '1' }, { assetId: '2' }])
            .mockResolvedValueOnce([{ assetId: '2' }, { assetId: '3' }])
        mocks.getAssetsByIds.mockResolvedValue([{ assetId: '1' }])

        const { result } = renderHook(
            () =>
                useHeldAssetDetailsQuery(['A', 'B'], SCOPE, {
                    kind: 'fungible',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.assets).toEqual([{ assetId: '1' }]),
        )
        expect(mocks.getAccountHoldingsLite).toHaveBeenCalledWith({
            sources: [{ address: 'A', scope: SCOPE }],
            hideZeroBalance: true,
            hideNfts: true,
        })
        expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
            assetIds: ['1', '2', '3'],
            scope: SCOPE,
        })
        expect(mocks.getAccountCollectiblesLite).not.toHaveBeenCalled()
    })

    it('reads collectibles with a balance and caps the ids looked up', async () => {
        mocks.getAccountCollectiblesLite.mockResolvedValue([
            { assetId: '1' },
            { assetId: '2' },
            { assetId: '3' },
        ])

        renderHook(
            () =>
                useHeldAssetDetailsQuery(['A'], SCOPE, {
                    kind: 'collectible',
                    maxAssetIds: 2,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
                assetIds: ['1', '2'],
                scope: SCOPE,
            }),
        )
        expect(mocks.getAccountCollectiblesLite).toHaveBeenCalledWith({
            sources: [{ address: 'A', scope: SCOPE }],
            includeZeroBalance: false,
        })
    })

    it('reads nothing when disabled or given no addresses', () => {
        const { result: disabled } = renderHook(
            () =>
                useHeldAssetDetailsQuery(['A'], SCOPE, {
                    kind: 'fungible',
                    enabled: false,
                }),
            { wrapper },
        )
        renderHook(
            () => useHeldAssetDetailsQuery([], SCOPE, { kind: 'fungible' }),
            { wrapper },
        )

        expect(disabled.current.assets).toBeUndefined()
        expect(mocks.getAccountHoldingsLite).not.toHaveBeenCalled()
    })

    it('reports a failed read', async () => {
        mocks.getAccountHoldingsLite.mockRejectedValue(new Error('db'))

        const { result } = renderHook(
            () => useHeldAssetDetailsQuery(['A'], SCOPE, { kind: 'fungible' }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.assets).toBeUndefined()
    })
})
