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
import { renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useToggleAssetFavoriteMutation } from '../useToggleAssetFavoriteMutation'
import { toggleAssetFavorite } from '../../api'
import { updateAssetPeraMetadata } from '../../db'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { getAssetDetailsQueryKey, getAssetsQueryKey } from '../querykeys'
import { type PeraAsset, PeraAssetVerificationTier } from '../../models/assets'

const buildAsset = (isFavorited: boolean): PeraAsset => ({
    assetId: '123',
    decimals: 0,
    creator: { address: '' },
    totalSupply: new Decimal(0),
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.unverified,
        isFavorited,
        isPriceAlertEnabled: false,
    },
})

vi.mock('../../api', () => ({
    toggleAssetFavorite: vi.fn(),
}))

vi.mock('../../db', () => ({
    updateAssetPeraMetadata: vi.fn(),
}))

const mockToggleResponse = {
    is_enabled: true,
}

describe('useToggleAssetFavoriteMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
                mutations: {
                    retry: false,
                },
            },
        })
    })

    it('calls toggleAssetFavorite with correct parameters when enabling', async () => {
        vi.mocked(toggleAssetFavorite).mockResolvedValue(mockToggleResponse)

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(toggleAssetFavorite).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'device-123',
                enabled: true,
                network: 'mainnet',
            }),
            expect.any(Object),
        )
    })

    it('calls toggleAssetFavorite with correct parameters when disabling', async () => {
        vi.mocked(toggleAssetFavorite).mockResolvedValue(mockToggleResponse)

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: false,
            network: 'testnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(toggleAssetFavorite).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'device-123',
                enabled: false,
                network: 'testnet',
            }),
            expect.any(Object),
        )
    })

    it('handles mutation error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(toggleAssetFavorite).mockRejectedValue(mockError)

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBe(mockError)
    })

    it('returns isLoading true while mutation is in progress', async () => {
        let resolvePromise: (value: typeof mockToggleResponse) => void
        const promise = new Promise<typeof mockToggleResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(toggleAssetFavorite).mockReturnValue(promise)

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.isLoading).toBe(false)

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(true)
        })

        resolvePromise!(mockToggleResponse)

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.isLoading).toBe(false)
    })

    it('writes the new value to the DB before the mutation resolves so background refetches see it', async () => {
        let resolvePromise: (value: typeof mockToggleResponse) => void
        const promise = new Promise<typeof mockToggleResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(toggleAssetFavorite).mockReturnValue(promise)

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(updateAssetPeraMetadata).toHaveBeenCalledWith({
                assetId: '123',
                network: 'mainnet',
                updates: { isFavorited: true },
            })
        })

        expect(result.current.isSuccess).toBe(false)

        resolvePromise!(mockToggleResponse)

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })
    })

    it('returns correct state when mutation is idle', () => {
        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
        expect(result.current.isSuccess).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('optimistically updates the cached asset before the mutation resolves', async () => {
        const queryKey = getAssetDetailsQueryKey('123', 'mainnet')
        queryClient.setQueryData<PeraAsset>(queryKey, buildAsset(false))

        let resolvePromise: (value: typeof mockToggleResponse) => void
        const promise = new Promise<typeof mockToggleResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(toggleAssetFavorite).mockReturnValue(promise)

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(
                queryClient.getQueryData<PeraAsset>(queryKey)?.peraMetadata
                    ?.isFavorited,
            ).toBe(true)
        })

        resolvePromise!(mockToggleResponse)

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })
    })

    it('rolls the cache back to its previous value when the mutation fails', async () => {
        const queryKey = getAssetDetailsQueryKey('123', 'mainnet')
        const original = buildAsset(false)
        queryClient.setQueryData<PeraAsset>(queryKey, original)

        vi.mocked(toggleAssetFavorite).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(
            queryClient.getQueryData<PeraAsset>(queryKey)?.peraMetadata
                ?.isFavorited,
        ).toBe(false)
    })

    it('rolls the DB write back to the previous value when the mutation fails', async () => {
        const queryKey = getAssetDetailsQueryKey('123', 'mainnet')
        queryClient.setQueryData<PeraAsset>(queryKey, buildAsset(false))

        vi.mocked(toggleAssetFavorite).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(updateAssetPeraMetadata).toHaveBeenNthCalledWith(1, {
            assetId: '123',
            network: 'mainnet',
            updates: { isFavorited: true },
        })
        expect(updateAssetPeraMetadata).toHaveBeenNthCalledWith(2, {
            assetId: '123',
            network: 'mainnet',
            updates: { isFavorited: false },
        })
    })

    it('invalidates the asset list cache on success so list views refetch', async () => {
        vi.mocked(toggleAssetFavorite).mockResolvedValue(mockToggleResponse)

        const listKey = getAssetsQueryKey(['123'], 'mainnet')
        queryClient.setQueryData<PeraAsset[]>(listKey, [buildAsset(false)])

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
        })
    })

    it('invalidates the asset list cache on error so the rolled-back value is read', async () => {
        const detailsKey = getAssetDetailsQueryKey('123', 'mainnet')
        queryClient.setQueryData<PeraAsset>(detailsKey, buildAsset(false))

        const listKey = getAssetsQueryKey(['123'], 'mainnet')
        queryClient.setQueryData<PeraAsset[]>(listKey, [buildAsset(false)])

        vi.mocked(toggleAssetFavorite).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(() => useToggleAssetFavoriteMutation(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    })

    it('notifies onLocalWrite after the optimistic DB write, before the mutation resolves', async () => {
        const onLocalWrite = vi.fn()
        let resolvePromise: (value: typeof mockToggleResponse) => void
        const promise = new Promise<typeof mockToggleResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(toggleAssetFavorite).mockReturnValue(promise)

        const { result } = renderHook(
            () => useToggleAssetFavoriteMutation({ onLocalWrite }),
            { wrapper: createWrapper(queryClient) },
        )

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(onLocalWrite).toHaveBeenCalledTimes(1)
        })

        expect(updateAssetPeraMetadata).toHaveBeenCalledBefore(onLocalWrite)
        expect(result.current.isSuccess).toBe(false)

        resolvePromise!(mockToggleResponse)

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })
    })

    it('notifies onLocalWrite again after the rollback write when the mutation fails', async () => {
        const onLocalWrite = vi.fn()
        queryClient.setQueryData<PeraAsset>(
            getAssetDetailsQueryKey('123', 'mainnet'),
            buildAsset(false),
        )
        vi.mocked(toggleAssetFavorite).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(
            () => useToggleAssetFavoriteMutation({ onLocalWrite }),
            { wrapper: createWrapper(queryClient) },
        )

        result.current.toggleAssetFavorite({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(onLocalWrite).toHaveBeenCalledTimes(2)
    })
})
