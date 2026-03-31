/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useToggleAssetFavoriteMutation } from '../useToggleAssetFavoriteMutation'
import { toggleAssetFavorite } from '../../api'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { getAssetDetailsQueryKey } from '../querykeys'

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

    it('invalidates asset query on success', async () => {
        vi.mocked(toggleAssetFavorite).mockResolvedValue(mockToggleResponse)

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

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

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: getAssetDetailsQueryKey('123'),
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
})
