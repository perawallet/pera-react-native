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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSeedSwapRouteAssets } from '../useSeedSwapRouteAssets'

const OUT_ID = '31566704'
const IN_ID = '887406851'
const ALGO_ID = '0'

const mockOutAsset = { assetId: OUT_ID, unitName: 'USDC', decimals: 6 }
const mockInAsset = { assetId: IN_ID, unitName: 'wSOL', decimals: 8 }

const mockUseAssetByIdQuery = vi.hoisted(() => vi.fn())
const mockSetQueryData = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
    getAssetsQueryKey: (assetIDs: string[], network: string) => [
        'assets',
        { assetIDs, network },
    ],
    useAssetByIdQuery: mockUseAssetByIdQuery,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({ setQueryData: mockSetQueryData })),
}))

describe('useSeedSwapRouteAssets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Resolve the asset by id only when the query is enabled (non-ALGO id
        // present), mirroring useAssetByIdQuery's enabled gating.
        mockUseAssetByIdQuery.mockImplementation(
            (id: string, options?: { enabled?: boolean }) => {
                if (options?.enabled === false) return { data: undefined }
                if (id === OUT_ID) return { data: mockOutAsset }
                if (id === IN_ID) return { data: mockInAsset }
                return { data: undefined }
            },
        )
    })

    it('seeds the asset cache for a non-opted-in output asset', () => {
        renderHook(() => useSeedSwapRouteAssets({ assetOutId: OUT_ID }))

        expect(mockSetQueryData).toHaveBeenCalledTimes(1)
        const [key] = mockSetQueryData.mock.calls[0]
        expect(key).toEqual([
            'assets',
            { assetIDs: [OUT_ID], network: 'mainnet' },
        ])
    })

    it('appends the fetched asset, overwriting an already-cached empty result', () => {
        renderHook(() => useSeedSwapRouteAssets({ assetOutId: OUT_ID }))

        const [, updater] = mockSetQueryData.mock.calls[0]
        expect(updater(undefined)).toEqual([mockOutAsset])
        expect(updater([])).toEqual([mockOutAsset])
    })

    it('does not duplicate an asset that is already cached', () => {
        renderHook(() => useSeedSwapRouteAssets({ assetOutId: OUT_ID }))

        const [, updater] = mockSetQueryData.mock.calls[0]
        const existing = [{ assetId: OUT_ID, unitName: 'USDC', decimals: 6 }]
        expect(updater(existing)).toBe(existing)
    })

    it('does not fetch or seed when the output asset is ALGO', () => {
        renderHook(() => useSeedSwapRouteAssets({ assetOutId: ALGO_ID }))

        expect(mockUseAssetByIdQuery).toHaveBeenCalledWith(
            ALGO_ID,
            expect.objectContaining({ enabled: false }),
        )
        expect(mockSetQueryData).not.toHaveBeenCalled()
    })

    it('does nothing when no route params are provided', () => {
        renderHook(() => useSeedSwapRouteAssets({}))

        expect(mockSetQueryData).not.toHaveBeenCalled()
    })

    it('seeds a non-ALGO input asset as well', () => {
        renderHook(() =>
            useSeedSwapRouteAssets({ assetInId: IN_ID, assetOutId: OUT_ID }),
        )

        expect(mockSetQueryData).toHaveBeenCalledTimes(2)
        const seededKeys = mockSetQueryData.mock.calls.map(([key]) => key)
        expect(seededKeys).toContainEqual([
            'assets',
            { assetIDs: [IN_ID], network: 'mainnet' },
        ])
        expect(seededKeys).toContainEqual([
            'assets',
            { assetIDs: [OUT_ID], network: 'mainnet' },
        ])
    })
})
