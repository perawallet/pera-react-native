import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    useSingleAssetDetailsQuery,
} from '../useSingleAssetDetailsQuery'
import { ALGO_ASSET_ID } from '../../models'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssetDetails: vi.fn(),
    fetchIndexerAssetDetails: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
}))

vi.mock('../endpoints', () => ({
    fetchAssetDetails: mocks.fetchAssetDetails,
    fetchIndexerAssetDetails: mocks.fetchIndexerAssetDetails,
    fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
}))

describe('useSingleAssetDetailsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    describe('useSingleAssetDetailsQuery hook', () => {
        it('returns ALGO asset details when asset_id is ALGO_ASSET_ID', async () => {
            mocks.fetchPublicAssetDetails.mockResolvedValue({
                asset_id: 0,
                name: 'Algorand',
                unit_name: 'ALGO',
                fraction_decimals: 6,
                total_supply_as_str: '10000000000000000',
                is_deleted: 'false',
                verification_tier: 'verified',
                creator_address: '',
                url: '',
            })

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery(ALGO_ASSET_ID),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data).toEqual(expect.objectContaining({
                assetId: ALGO_ASSET_ID,
                name: 'Algo',
            }))
        })

        it('combines indexer and pera data for other assets', async () => {
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
            expect(result.current.data?.name).toBe('Pera Name') // Pera data overrides indexer
            expect(result.current.data?.unitName).toBe('TEST') // From indexer
        })

        it('handles loading state', () => {
            mocks.fetchAssetDetails.mockReturnValue(new Promise(() => { }))
            mocks.fetchIndexerAssetDetails.mockReturnValue(new Promise(() => { }))
            mocks.fetchPublicAssetDetails.mockReturnValue(new Promise(() => { }))

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            expect(result.current.isLoading).toBe(true)
        })

        it('handles error state', async () => {
            mocks.fetchAssetDetails.mockRejectedValue(new Error('Pera Error'))
            mocks.fetchIndexerAssetDetails.mockRejectedValue(new Error('Indexer Error'))
            mocks.fetchPublicAssetDetails.mockResolvedValue({})

            const { result } = renderHook(
                () => useSingleAssetDetailsQuery('123'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
        })
    })
})
