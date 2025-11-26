import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    useSingleAssetDetails,
    useSingleAssetDetailsQueryKeys,
} from '../useSingleAssetDetails'
import { ALGO_ASSET_ID, ALGO_ASSET } from '../../../services/assets'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock dependencies
const mockUseV1AssetsRead = vi.hoisted(() => vi.fn())
const mockUseV1PublicAssetsRead = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    useV1AssetsRead: mockUseV1AssetsRead,
    useV1PublicAssetsRead: mockUseV1PublicAssetsRead,
    v1AssetsReadQueryKey: vi.fn(() => ['assetsRead']),
}))

const mockUseLookupAssetByID = vi.hoisted(() => vi.fn())
vi.mock('../../../api/generated/indexer', () => ({
    useLookupAssetByID: mockUseLookupAssetByID,
    lookupAssetByIDQueryKey: vi.fn(() => ['lookupAsset']),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useSingleAssetDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useSingleAssetDetailsQueryKeys', () => {
        it('returns correct query keys', () => {
            const { result } = renderHook(() =>
                useSingleAssetDetailsQueryKeys(123),
            )
            expect(result.current).toEqual([['assetsRead'], ['lookupAsset']])
        })
    })

    describe('useSingleAssetDetails hook', () => {
        it('returns ALGO asset details when asset_id is ALGO_ASSET_ID', () => {
            mockUseV1AssetsRead.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: false,
                isPending: false,
                error: null,
                refetch: vi.fn(),
            })
            mockUseLookupAssetByID.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: false,
                isPending: false,
                error: null,
                refetch: vi.fn(),
            })
            mockUseV1PublicAssetsRead.mockReturnValue({
                data: undefined,
                refetch: vi.fn(),
            })

            const { result } = renderHook(
                () => useSingleAssetDetails({ asset_id: ALGO_ASSET_ID }),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.data).toEqual(ALGO_ASSET)
            expect(result.current.isLoading).toBe(false)
        })

        it('calls algoRefetch when refetch is called for ALGO asset', () => {
            const algoRefetchMock = vi.fn()
            mockUseV1AssetsRead.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: false,
                isPending: false,
                error: null,
                refetch: vi.fn(),
            })
            mockUseLookupAssetByID.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: false,
                isPending: false,
                error: null,
                refetch: vi.fn(),
            })
            mockUseV1PublicAssetsRead.mockReturnValue({
                data: undefined,
                refetch: algoRefetchMock,
            })

            const { result } = renderHook(
                () => useSingleAssetDetails({ asset_id: ALGO_ASSET_ID }),
                {
                    wrapper: createWrapper(),
                },
            )

            result.current.refetch()

            expect(algoRefetchMock).toHaveBeenCalled()
        })

        it('combines indexer and pera data for other assets', () => {
            mockUseV1AssetsRead.mockReturnValue({
                data: { asset_id: 123, name: 'Pera Name' },
                isLoading: false,
                isError: false,
                isPending: false,
                refetch: vi.fn(),
            })

            mockUseLookupAssetByID.mockReturnValue({
                data: {
                    asset: {
                        index: 123,
                        params: {
                            decimals: 6,
                            'unit-name': 'TEST',
                            name: 'Indexer Name',
                            total: 1000,
                        },
                    },
                },
                isLoading: false,
                isError: false,
                isPending: false,
                refetch: vi.fn(),
            })

            const { result } = renderHook(
                () => useSingleAssetDetails({ asset_id: 123 }),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.data).toBeDefined()
            expect(result.current.data?.asset_id).toBe(123)
            expect(result.current.data?.name).toBe('Pera Name') // Pera data overrides indexer
            expect(result.current.data?.unit_name).toBe('TEST') // From indexer
        })

        it('calls both peraRefetch and indexerRefetch when refetch is called for non-ALGO asset', () => {
            const peraRefetchMock = vi.fn()
            const indexerRefetchMock = vi.fn()

            mockUseV1AssetsRead.mockReturnValue({
                data: { asset_id: 123, name: 'Pera Name' },
                isLoading: false,
                isError: false,
                isPending: false,
                refetch: peraRefetchMock,
            })

            mockUseLookupAssetByID.mockReturnValue({
                data: {
                    asset: {
                        index: 123,
                        params: {
                            decimals: 6,
                            'unit-name': 'TEST',
                            name: 'Indexer Name',
                            total: 1000,
                        },
                    },
                },
                isLoading: false,
                isError: false,
                isPending: false,
                refetch: indexerRefetchMock,
            })

            const { result } = renderHook(
                () => useSingleAssetDetails({ asset_id: 123 }),
                {
                    wrapper: createWrapper(),
                },
            )

            result.current.refetch()

            expect(peraRefetchMock).toHaveBeenCalled()
            expect(indexerRefetchMock).toHaveBeenCalled()
        })

        it('handles loading state', () => {
            mockUseV1AssetsRead.mockReturnValue({
                data: undefined,
                isLoading: true,
                isPending: true,
            })
            mockUseLookupAssetByID.mockReturnValue({
                data: undefined,
                isLoading: false,
                isPending: false,
            })

            const { result } = renderHook(
                () => useSingleAssetDetails({ asset_id: 123 }),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isLoading).toBe(true)
            expect(result.current.isPending).toBe(true)
        })

        it('handles error state', () => {
            mockUseV1AssetsRead.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: true,
                error: new Error('Pera Error'),
            })
            mockUseLookupAssetByID.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: true,
                error: new Error('Indexer Error'),
            })

            const { result } = renderHook(
                () => useSingleAssetDetails({ asset_id: 123 }),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isError).toBe(true)
            expect(result.current.error).toEqual(new Error('Indexer Error')) // or Pera Error, depending on logic
        })
    })
})
