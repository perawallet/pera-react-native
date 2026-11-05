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
import type {
    AssetRef,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollectibleMetadataQuery } from '../useCollectibleMetadataQuery'
import { registerFakeAssetsAdapter } from '../../__tests__/fakeAssetsChain'
import { createWrapper } from './test-utils'

const mocks = vi.hoisted(() => ({ getAssetById: vi.fn() }))

vi.mock('../../db', () => ({ getAssetById: mocks.getAssetById }))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const NFT_ID = 'nft-1'

const assetOf = (name: string) => ({
    assetId: NFT_ID,
    name,
    decimals: 0,
    creator: { address: 'ADDR' },
    totalSupply: new Decimal(1),
})

const render = (assetId: string, queryClient: QueryClient) =>
    renderHook(() => useCollectibleMetadataQuery(assetId, SCOPE), {
        wrapper: createWrapper(queryClient),
    })

describe('useCollectibleMetadataQuery', () => {
    let queryClient: QueryClient
    let onError: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getAssetById.mockResolvedValue(null)
        onError = vi.fn()
        queryClient = new QueryClient()
        queryClient.getQueryCache().subscribe(event => {
            if (event.type === 'updated' && event.action.type === 'error') {
                onError(event.action.error)
            }
        })
    })

    it("resolves the chain's lookup for the collectible", async () => {
        const find = vi.fn(async (_ref: AssetRef) => assetOf('Nuri #75'))
        registerFakeAssetsAdapter({ findCollectibleMetadata: find })

        const { result } = render(NFT_ID, queryClient)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data?.name).toBe('Nuri #75')
        expect(find).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: NFT_ID },
            SCOPE,
        )
    })

    it('settles on the stored row when the lookup misses, without an error', async () => {
        registerFakeAssetsAdapter({
            findCollectibleMetadata: vi.fn(async () => null),
        })
        mocks.getAssetById.mockResolvedValue(assetOf('Stored'))

        const { result } = render(NFT_ID, queryClient)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data?.name).toBe('Stored')
        expect(onError).not.toHaveBeenCalled()
    })

    it('settles on null when neither the lookup nor the store has it, without an error', async () => {
        registerFakeAssetsAdapter({
            findCollectibleMetadata: vi.fn(async () => null),
        })

        const { result } = render(NFT_ID, queryClient)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toBeNull()
        expect(onError).not.toHaveBeenCalled()
    })

    it('reads only the store on a chain with no lookup', async () => {
        registerFakeAssetsAdapter()
        mocks.getAssetById.mockResolvedValue(assetOf('Stored'))

        const { result } = render(NFT_ID, queryClient)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data?.name).toBe('Stored')
    })

    it('asks nothing without an id', () => {
        const find = vi.fn(async () => null)
        registerFakeAssetsAdapter({ findCollectibleMetadata: find })

        const { result } = render('', queryClient)

        expect(result.current.data).toBeNull()
        expect(find).not.toHaveBeenCalled()
        expect(mocks.getAssetById).not.toHaveBeenCalled()
    })
})
