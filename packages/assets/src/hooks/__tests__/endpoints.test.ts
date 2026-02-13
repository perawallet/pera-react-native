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
import { toggleAssetFavorite, toggleAssetPriceAlert } from '../endpoints'
import { Networks } from '@perawallet/wallet-core-shared'

// Track the last queryClient call for assertions
let lastQueryClientCall: any = null
let mockResponse: { data: any; status: number } | null = null
let mockError: Error | null = null

// Mock the core shared module
vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        queryClient: vi.fn(async (config: any) => {
            lastQueryClientCall = config
            if (mockError) {
                throw mockError
            }
            return mockResponse
        }),
    }
})

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
    is_favorited: true,
    is_price_alert_enabled: true,
}

describe('toggleAssetFavorite', () => {
    beforeEach(() => {
        lastQueryClientCall = null
        mockError = null
        mockResponse = {
            data: mockAssetResponse,
            status: 200,
        }
        vi.clearAllMocks()
    })

    it('calls queryClient with correct parameters when favoriting', async () => {
        const result = await toggleAssetFavorite({
            assetID: '123',
            deviceId: '12345',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall).not.toBeNull()
        expect(lastQueryClientCall?.url).toBe('/v2/assets/123/toggle-favorite/')
        expect(lastQueryClientCall?.method).toBe('POST')
        expect(lastQueryClientCall?.network).toBe('mainnet')
        expect(lastQueryClientCall?.data).toEqual({
            device_id: 12345,
            enabled: true,
        })
        expect(result).toEqual(mockAssetResponse)
    })

    it('calls queryClient with correct parameters when unfavoriting', async () => {
        const result = await toggleAssetFavorite({
            assetID: '456',
            deviceId: '67890',
            enabled: false,
            network: Networks.testnet,
        })

        expect(lastQueryClientCall).not.toBeNull()
        expect(lastQueryClientCall?.url).toBe('/v2/assets/456/toggle-favorite/')
        expect(lastQueryClientCall?.method).toBe('POST')
        expect(lastQueryClientCall?.network).toBe('testnet')
        expect(lastQueryClientCall?.data).toEqual({
            device_id: 67890,
            enabled: false,
        })
        expect(result).toEqual(mockAssetResponse)
    })

    it('converts deviceId string to number', async () => {
        await toggleAssetFavorite({
            assetID: '789',
            deviceId: '999',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall?.data?.device_id).toBe(999)
    })

    it('throws error when API fails', async () => {
        mockError = new Error('Network error')

        await expect(
            toggleAssetFavorite({
                assetID: '123',
                deviceId: '12345',
                enabled: true,
                network: Networks.mainnet,
            }),
        ).rejects.toThrow('Network error')
    })

    it('uses pera backend', async () => {
        await toggleAssetFavorite({
            assetID: '123',
            deviceId: '12345',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall?.backend).toBe('pera')
    })
})

describe('toggleAssetPriceAlert', () => {
    beforeEach(() => {
        lastQueryClientCall = null
        mockError = null
        mockResponse = {
            data: mockAssetResponse,
            status: 200,
        }
        vi.clearAllMocks()
    })

    it('calls queryClient with correct parameters when enabling alerts', async () => {
        const result = await toggleAssetPriceAlert({
            assetID: '123',
            deviceId: '12345',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall).not.toBeNull()
        expect(lastQueryClientCall?.url).toBe(
            '/v2/assets/123/toggle-price-alert/',
        )
        expect(lastQueryClientCall?.method).toBe('POST')
        expect(lastQueryClientCall?.network).toBe('mainnet')
        expect(lastQueryClientCall?.data).toEqual({
            device_id: 12345,
            enabled: true,
        })
        expect(result).toEqual(mockAssetResponse)
    })

    it('calls queryClient with correct parameters when disabling alerts', async () => {
        const result = await toggleAssetPriceAlert({
            assetID: '456',
            deviceId: '67890',
            enabled: false,
            network: Networks.testnet,
        })

        expect(lastQueryClientCall).not.toBeNull()
        expect(lastQueryClientCall?.url).toBe(
            '/v2/assets/456/toggle-price-alert/',
        )
        expect(lastQueryClientCall?.method).toBe('POST')
        expect(lastQueryClientCall?.network).toBe('testnet')
        expect(lastQueryClientCall?.data).toEqual({
            device_id: 67890,
            enabled: false,
        })
        expect(result).toEqual(mockAssetResponse)
    })

    it('converts deviceId string to number', async () => {
        await toggleAssetPriceAlert({
            assetID: '789',
            deviceId: '999',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall?.data?.device_id).toBe(999)
    })

    it('throws error when API fails', async () => {
        mockError = new Error('Network error')

        await expect(
            toggleAssetPriceAlert({
                assetID: '123',
                deviceId: '12345',
                enabled: true,
                network: Networks.mainnet,
            }),
        ).rejects.toThrow('Network error')
    })

    it('uses pera backend', async () => {
        await toggleAssetPriceAlert({
            assetID: '123',
            deviceId: '12345',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall?.backend).toBe('pera')
    })
})
