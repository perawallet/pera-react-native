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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { Networks } from '@perawallet/wallet-core-shared'

const mockQueryClient = vi.hoisted(() => vi.fn())
const mockFetchIndexerAssetDetails = vi.hoisted(() => vi.fn())
const mockTransformIndexerAssetResponse = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        queryClient: mockQueryClient,
    }
})

// Fully replaced (no `importActual`): the real `@perawallet/wallet-core-assets`
// barrel re-exports Zustand stores backed by react-native-mmkv, which cannot
// resolve outside the mobile runtime. These tests only need to verify that
// `indexer/endpoints.ts` wires the two functions it imports correctly, kept
// deliberately decoupled from the assets package's own internals.
// `transformIndexerAssetResponse`'s field mapping (decimals/unitName/name/
// totalSupply/creator) is covered separately in
// `packages/assets/src/api/assets/__tests__/transformers.test.ts` — do not
// assume coverage exists elsewhere without checking; it did not, for this
// function specifically, until that file was added.
vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchIndexerAssetDetails: mockFetchIndexerAssetDetails,
    transformIndexerAssetResponse: mockTransformIndexerAssetResponse,
}))

const { fetchIndexerTransactionHistory, fetchMoreIndexerTransactions } =
    await import('../endpoints')

// Real indexer responses omit `next-token` entirely at the tail of
// pagination rather than sending it as `null` (verified against the live
// fnet indexer) — the schema requires that key be a string or absent.
const emptyPage = {
    data: { 'current-round': 10, transactions: [] },
    status: 200,
    statusText: 'OK',
}

const pageWithAsset = {
    data: {
        'current-round': 10,
        transactions: [
            {
                id: 'TX1',
                'tx-type': 'axfer',
                sender: 'ABC123',
                fee: 1000,
                'confirmed-round': 5,
                'round-time': 1700000000,
                'asset-transfer-transaction': {
                    'asset-id': 888,
                    amount: 10,
                    receiver: 'OTHER',
                },
            },
        ],
    },
    status: 200,
    statusText: 'OK',
}

// `fetchIndexerAssetDetails` is mocked opaquely here — its raw indexer-response
// shape is covered by its own test in
// `packages/assets/src/api/assets/__tests__/endpoints.test.ts`
// ('fetchIndexerAssetDetails hits the indexer backend'). Only
// `transformIndexerAssetResponse`'s (also mocked) output shape matters to
// `buildAssetLookup`'s own logic, which is what this file tests.
const mockRawAssetResponse = { asset: { index: '888' }, 'current-round': 10 }
const mockPeraAsset = {
    assetId: '888',
    name: 'Foo Coin',
    unitName: 'FOO',
    decimals: 2,
    totalSupply: new Decimal(100),
    creator: { address: 'CREATOR' },
}

describe('fetchIndexerTransactionHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('requests the account-transactions endpoint on the indexer backend', async () => {
        mockQueryClient.mockResolvedValue(emptyPage)

        await fetchIndexerTransactionHistory({
            accountAddress: 'ABC123',
            network: Networks.betanet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'indexer',
                network: Networks.betanet,
                method: 'GET',
                url: '/v2/accounts/ABC123/transactions',
                params: expect.objectContaining({ limit: 25 }),
            }),
        )
    })

    it('enriches results with asset facts resolved from the indexer', async () => {
        mockQueryClient.mockResolvedValue(pageWithAsset)
        mockFetchIndexerAssetDetails.mockResolvedValue(mockRawAssetResponse)
        mockTransformIndexerAssetResponse.mockReturnValue(mockPeraAsset)

        const result = await fetchIndexerTransactionHistory({
            accountAddress: 'ABC123',
            network: Networks.betanet,
        })

        expect(mockFetchIndexerAssetDetails).toHaveBeenCalledWith(
            '888',
            Networks.betanet,
        )
        expect(mockTransformIndexerAssetResponse).toHaveBeenCalledWith(
            mockRawAssetResponse,
        )
        expect(result.transactions[0]?.asset).toEqual({
            assetId: '888',
            name: 'Foo Coin',
            unitName: 'FOO',
            decimals: 2,
        })
    })

    it('still returns the page when an asset lookup fails', async () => {
        mockQueryClient.mockResolvedValue(pageWithAsset)
        mockFetchIndexerAssetDetails.mockRejectedValue(
            new Error('indexer unreachable'),
        )

        const result = await fetchIndexerTransactionHistory({
            accountAddress: 'ABC123',
            network: Networks.betanet,
        })

        expect(result.transactions).toHaveLength(1)
        expect(result.transactions[0]?.asset).toEqual({
            assetId: '888',
            name: '',
            unitName: '',
            decimals: 0,
        })
    })
})

describe('fetchMoreIndexerTransactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('sends the stored cursor as the `next` param, not a replayable URL', async () => {
        mockQueryClient.mockResolvedValue(emptyPage)

        await fetchMoreIndexerTransactions({
            accountAddress: 'ABC123',
            nextToken: 'CURSOR1',
            network: Networks.betanet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'indexer',
                network: Networks.betanet,
                url: '/v2/accounts/ABC123/transactions',
                params: expect.objectContaining({ next: 'CURSOR1' }),
            }),
        )
    })

    it('carries the same asset-id / time filters as the first page — the next-token does not encode them', async () => {
        // Regression coverage: the indexer's opaque next-token does not
        // encode filters the way the Pera path's absolute next-URL does
        // (verified live — the same token with and without `asset-id`
        // returns different rows), so omitting these here would silently
        // widen a filtered list back to everything from page 2 onward.
        mockQueryClient.mockResolvedValue(emptyPage)

        await fetchMoreIndexerTransactions({
            accountAddress: 'ABC123',
            nextToken: 'CURSOR1',
            network: Networks.betanet,
            assetId: '31566704',
            afterTime: '2025-02-01',
            beforeTime: '2025-02-13',
            limit: 50,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'indexer',
                network: Networks.betanet,
                url: '/v2/accounts/ABC123/transactions',
                params: {
                    limit: 50,
                    next: 'CURSOR1',
                    'asset-id': '31566704',
                    'after-time': '2025-02-01',
                    'before-time': '2025-02-13',
                },
            }),
        )
    })
})
