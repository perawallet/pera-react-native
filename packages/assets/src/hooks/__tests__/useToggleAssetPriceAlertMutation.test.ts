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
import { useToggleAssetPriceAlertMutation } from '../useToggleAssetPriceAlertMutation'
import { toggleAssetPriceAlert } from '../../api'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { getAssetDetailsQueryKey } from '../querykeys'

vi.mock('../../api', () => ({
    toggleAssetPriceAlert: vi.fn(),
}))

const mockAssetResponse = {
    asset_id: 123,
    name: 'Test Asset',
    unit_name: 'TST',
    fraction_decimals: 6,
    total: '1000000',
    is_deleted: false,
    verification_tier: 'verified',
    creator: { address: 'CREATOR123' },
    category: null,
    is_verified: true,
    explorer_url: null,
    collectible: null,
    type: null,
    labels: null,
    logo: null,
    is_favorited: false,
    is_price_alert_enabled: true,
}

describe('useToggleAssetPriceAlertMutation', () => {
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

    it('calls toggleAssetPriceAlert with correct parameters when enabling', async () => {
        vi.mocked(toggleAssetPriceAlert).mockResolvedValue(mockAssetResponse)

        const { result } = renderHook(
            () => useToggleAssetPriceAlertMutation(),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        result.current.toggleAssetPriceAlert({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(toggleAssetPriceAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                assetID: '123',
                deviceId: 'device-123',
                enabled: true,
                network: 'mainnet',
            }),
            expect.any(Object),
        )
    })

    it('calls toggleAssetPriceAlert with correct parameters when disabling', async () => {
        vi.mocked(toggleAssetPriceAlert).mockResolvedValue(mockAssetResponse)

        const { result } = renderHook(
            () => useToggleAssetPriceAlertMutation(),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        result.current.toggleAssetPriceAlert({
            assetID: '123',
            deviceId: 'device-123',
            enabled: false,
            network: 'testnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(toggleAssetPriceAlert).toHaveBeenCalledWith(
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
        vi.mocked(toggleAssetPriceAlert).mockRejectedValue(mockError)

        const { result } = renderHook(
            () => useToggleAssetPriceAlertMutation(),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        result.current.toggleAssetPriceAlert({
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
        let resolvePromise: (value: typeof mockAssetResponse) => void
        const promise = new Promise<typeof mockAssetResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(toggleAssetPriceAlert).mockReturnValue(promise)

        const { result } = renderHook(
            () => useToggleAssetPriceAlertMutation(),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        expect(result.current.isLoading).toBe(false)

        result.current.toggleAssetPriceAlert({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(true)
        })

        resolvePromise!(mockAssetResponse)

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.isLoading).toBe(false)
    })

    it('invalidates asset details query on success', async () => {
        vi.mocked(toggleAssetPriceAlert).mockResolvedValue(mockAssetResponse)

        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(
            () => useToggleAssetPriceAlertMutation(),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        result.current.toggleAssetPriceAlert({
            assetID: '123',
            deviceId: 'device-123',
            enabled: true,
            network: 'mainnet' as const,
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: getAssetDetailsQueryKey('123'),
        })
    })

    it('returns correct state when mutation is idle', () => {
        const { result } = renderHook(
            () => useToggleAssetPriceAlertMutation(),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
        expect(result.current.isSuccess).toBe(false)
        expect(result.current.error).toBeNull()
    })
})
