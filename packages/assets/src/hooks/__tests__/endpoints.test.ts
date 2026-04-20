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
import { toggleAssetFavorite, toggleAssetPriceAlert } from '../../api'
import { Networks, type Nullable } from '@perawallet/wallet-core-shared'

// Track the last queryClient call for assertions
let lastQueryClientCall: any = null
let mockResponse: Nullable<{ data: any; status: number }> = null
let mockError: Nullable<Error> = null

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

const mockToggleResponse = {
    is_enabled: true,
}

describe('toggleAssetFavorite', () => {
    beforeEach(() => {
        lastQueryClientCall = null
        mockError = null
        mockResponse = {
            data: mockToggleResponse,
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
        expect(lastQueryClientCall?.body).toBe(
            '{"device_id":12345,"enabled":true}',
        )
        expect(result).toEqual(mockToggleResponse)
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
        expect(lastQueryClientCall?.body).toBe(
            '{"device_id":67890,"enabled":false}',
        )
        expect(result).toEqual(mockToggleResponse)
    })

    it('preserves large device ID precision', async () => {
        await toggleAssetFavorite({
            assetID: '789',
            deviceId: '3721650761318318592',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall?.body).toBe(
            '{"device_id":3721650761318318592,"enabled":true}',
        )
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
            data: mockToggleResponse,
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
        expect(lastQueryClientCall?.body).toBe(
            '{"device_id":12345,"enabled":true}',
        )
        expect(result).toEqual(mockToggleResponse)
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
        expect(lastQueryClientCall?.body).toBe(
            '{"device_id":67890,"enabled":false}',
        )
        expect(result).toEqual(mockToggleResponse)
    })

    it('preserves large device ID precision', async () => {
        await toggleAssetPriceAlert({
            assetID: '789',
            deviceId: '3721650761318318592',
            enabled: true,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall?.body).toBe(
            '{"device_id":3721650761318318592,"enabled":true}',
        )
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
