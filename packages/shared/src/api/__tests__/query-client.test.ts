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
import { queryClient } from '../query-client'

// Mock config
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        mainnetBackendUrl: 'https://mainnet.pera.algo',
        testnetBackendUrl: 'https://testnet.pera.algo',
        mainnetAlgodUrl: 'https://mainnet.algod.algo',
        testnetAlgodUrl: 'https://testnet.algod.algo',
        mainnetIndexerUrl: 'https://mainnet.indexer.algo',
        testnetIndexerUrl: 'https://testnet.indexer.algo',
        debugEnabled: false,
    },
}))

// Mock ky
const { mockKy, mockJson } = vi.hoisted(() => {
    const mockJson = vi.fn()
    const mockKy: any = vi.fn()
    mockKy.mockReturnValue({
        json: mockJson,
        status: 200,
        statusText: 'OK',
    })
    mockKy.extend = vi.fn().mockReturnValue(mockKy)
    return { mockKy, mockJson }
})

vi.mock('ky', () => ({
    default: {
        create: vi.fn(() => mockKy),
    },
}))

describe('queryClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should make a successful request to pera backend on mainnet', async () => {
        const mockData = { success: true }
        mockJson.mockResolvedValue(mockData)

        const response = await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test-endpoint',
            method: 'GET',
        })

        expect(response.data).toEqual(mockData)
        expect(response.status).toBe(200)
    })

    it('should throw an error if URL is missing', async () => {
        await expect(
            queryClient({
                backend: 'pera',
                network: 'mainnet',
                url: '',
                method: 'GET',
            }),
        ).rejects.toThrow('URL is required')
    })
})
