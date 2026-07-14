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

import { renderHook, waitFor } from '@testing-library/react'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSingleAssetDetailsQuery } from '../useSingleAssetDetailsQuery'

import { createWrapper } from './test-utils'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssetDetails: vi.fn(),
    fetchIndexerAssetDetails: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
    useNetwork: vi.fn(),
    getAssetById: vi.fn(),
    getAssetPeraMetadata: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

vi.mock('../../db', () => ({
    getAssetById: mocks.getAssetById,
    getAssetPeraMetadata: mocks.getAssetPeraMetadata,
}))

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return {
        ...actual,
        fetchAssetDetails: mocks.fetchAssetDetails,
        fetchIndexerAssetDetails: mocks.fetchIndexerAssetDetails,
        fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
    }
})

describe('useSingleAssetDetailsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        mocks.getAssetById.mockResolvedValue(null)
        mocks.getAssetPeraMetadata.mockResolvedValue(null)
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    afterEach(() => {
        // Restore the global onlineManager singleton so offline state set by a
        // test can't leak into subsequent tests.
        onlineManager.setOnline(true)
    })

    describe('useSingleAssetDetailsQuery hook', () => {
        it('serves asset details from SQLite while offline', async () => {
            onlineManager.setOnline(false)

            const dbAsset = {
                assetId: '123',
                decimals: 6,
                creator: { address: 'ADDR' },
                totalSupply: new Decimal(1000),
                name: 'Offline DB Asset',
                unitName: 'TEST',
            }
            mocks.getAssetById.mockResolvedValue(dbAsset)

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data).toEqual(dbAsset)
            expect(mocks.getAssetById).toHaveBeenCalledWith({
                assetId: '123',
                network: 'mainnet',
            })
        })

        it('returns ALGO asset details from DB when asset_id is ALGO_ASSET_ID', async () => {
            mocks.getAssetById.mockResolvedValue({
                assetId: ALGO_ASSET_ID,
                name: 'Algo',
                unitName: 'ALGO',
                decimals: 6,
                totalSupply: new Decimal('10000000000000000000'),
                creator: { address: '' },
            })

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery(ALGO_ASSET_ID),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.data).toBeDefined())

            expect(result.current.data).toEqual(
                expect.objectContaining({
                    assetId: ALGO_ASSET_ID,
                    name: 'Algo',
                }),
            )
            expect(mocks.getAssetById).toHaveBeenCalledWith({
                assetId: ALGO_ASSET_ID,
                network: 'mainnet',
            })
        })

        it('reads asset from DB when available', async () => {
            const dbAsset = {
                assetId: '123',
                decimals: 6,
                creator: { address: 'ADDR' },
                totalSupply: new Decimal(1000),
                name: 'DB Asset',
                unitName: 'TEST',
            }
            mocks.getAssetById.mockResolvedValue(dbAsset)

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data).toEqual(dbAsset)
            expect(mocks.getAssetById).toHaveBeenCalledWith({
                assetId: '123',
                network: 'mainnet',
            })
            // Should NOT call APIs when DB has data
            expect(mocks.fetchAssetDetails).not.toHaveBeenCalled()
            expect(mocks.fetchIndexerAssetDetails).not.toHaveBeenCalled()
        })

        it('falls back to API when asset not in DB', async () => {
            mocks.getAssetById.mockResolvedValue(null)

            mocks.fetchAssetDetails.mockResolvedValue({
                asset_id: 123,
                name: 'Pera Name',
                fraction_decimals: 6,
                total: '1000',
                is_deleted: false,
                verification_tier: 'unverified',
                creator: { address: 'ADDR' },
                category: null,
            })

            mocks.fetchIndexerAssetDetails.mockResolvedValue({
                asset: {
                    index: 123,
                    params: {
                        decimals: 6,
                        'unit-name': 'TEST',
                        name: 'Indexer Name',
                        total: 1000,
                        creator: 'ADDR',
                    },
                },
            })

            mocks.fetchPublicAssetDetails.mockResolvedValue({
                asset_id: 123,
                name: 'Public Name',
            })

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data).toBeDefined()
            expect(result.current.data?.assetId).toBe('123')
            expect(result.current.data?.name).toBe('Pera Name')
            expect(result.current.data?.unitName).toBe('TEST')
        })

        it('preserves peraMetadata fields from pera API when public API overwrites peraMetadata', async () => {
            mocks.getAssetById.mockResolvedValue(null)

            mocks.fetchAssetDetails.mockResolvedValue({
                asset_id: 123,
                name: 'Pera Name',
                fraction_decimals: 6,
                total: '1000',
                is_deleted: false,
                verification_tier: 'verified',
                creator: { address: 'ADDR' },
                category: null,
                is_favorited: true,
                is_price_alert_enabled: true,
                logo: 'https://pera-logo.png',
            })

            mocks.fetchIndexerAssetDetails.mockResolvedValue({
                asset: {
                    index: 123,
                    params: {
                        decimals: 6,
                        'unit-name': 'TEST',
                        name: 'Indexer Name',
                        total: 1000,
                        creator: 'ADDR',
                    },
                },
            })

            mocks.fetchPublicAssetDetails.mockResolvedValue({
                asset_id: 123,
                name: 'Public Name',
                fraction_decimals: 6,
                total_supply: 1000,
                total_supply_as_str: '1000',
                is_deleted: false,
                verification_tier: 'verified',
                is_collectible: false,
                logo: 'https://public-logo.png',
            })

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data?.peraMetadata?.isFavorited).toBe(true)
            expect(result.current.data?.peraMetadata?.isPriceAlertEnabled).toBe(
                true,
            )
            expect(result.current.data?.peraMetadata?.logo).toBe(
                'https://pera-logo.png',
            )
        })

        it('handles loading state', () => {
            mocks.getAssetById.mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            expect(result.current.isLoading).toBe(true)
        })

        it('handles error state when both DB and API fail', async () => {
            mocks.getAssetById.mockResolvedValue(null)
            mocks.fetchAssetDetails.mockRejectedValue(new Error('Pera Error'))
            mocks.fetchIndexerAssetDetails.mockRejectedValue(
                new Error('Indexer Error'),
            )
            mocks.fetchPublicAssetDetails.mockRejectedValue(
                new Error('Public Error'),
            )

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            // The hook uses Promise.allSettled, so individual API failures
            // won't cause the query to error - it returns partial data
            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data).toBeDefined()
            expect(result.current.data?.assetId).toBe('123')
        })
    })
})
