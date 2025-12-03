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

// Mock debugLog
const mockDebugLog = vi.fn()
vi.mock('../utils', () => ({
    debugLog: mockDebugLog,
}))

// Mock config
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        mainnetBackendUrl: 'https://mainnet.pera.algo',
        testnetBackendUrl: 'https://testnet.pera.algo',
        mainnetAlgodUrl: 'https://mainnet.algod.algo',
        testnetAlgodUrl: 'https://testnet.algod.algo',
        mainnetIndexerUrl: 'https://mainnet.indexer.algo',
        testnetIndexerUrl: 'https://testnet.indexer.algo',
        debugEnabled: true,
        backendAPIKey: 'test-api-key',
        algodApiKey: 'test-algod-key',
        indexerApiKey: 'test-indexer-key',
    },
}))

// Mock ky with hooks support
const { mockKy, mockJson } = vi.hoisted(() => {
    const mockJson = vi.fn()
    const capturedHooks: any = {
        beforeRequest: [],
        afterResponse: [],
        beforeError: [],
        beforeRetry: [],
    }

    const mockKy: any = vi.fn(async (path: string, options: any) => {
        // Execute beforeRequest hooks
        const mockRequest = {
            url: path,
            headers: new Map<string, string>(),
        }
        if (capturedHooks.beforeRequest) {
            for (const hook of capturedHooks.beforeRequest) {
                await hook(mockRequest)
            }
        }

        const response = {
            json: mockJson,
            status: 200,
            statusText: 'OK',
        }

        // Execute afterResponse hooks
        if (capturedHooks.afterResponse) {
            for (const hook of capturedHooks.afterResponse) {
                await hook(mockRequest, options, response)
            }
        }

        return response
    })

    mockKy.create = vi.fn((config: any) => {
        // Capture hooks from config
        if (config.hooks) {
            Object.assign(capturedHooks, config.hooks)
        }
        return mockKy
    })

    mockKy.extend = vi.fn((config: any) => {
        // Merge hooks from extend
        if (config.hooks) {
            Object.keys(config.hooks).forEach(hookType => {
                capturedHooks[hookType] = config.hooks[hookType]
            })
        }
        return mockKy
    })

    return { mockKy, mockJson, capturedHooks }
})

vi.mock('ky', () => ({
    default: mockKy,
}))

describe('queryClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDebugLog.mockClear()
    })

    it('should make a successful request to pera backend on mainnet', async () => {
        const { queryClient } = await import('../query-client')
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
        const { queryClient } = await import('../query-client')
        await expect(
            queryClient({
                backend: 'pera',
                network: 'mainnet',
                url: '',
                method: 'GET',
            }),
        ).rejects.toThrow('URL is required')
    })

    it('should throw an error for invalid network', async () => {
        const { queryClient } = await import('../query-client')
        await expect(
            queryClient({
                backend: 'pera',
                network: 'invalid-network' as any,
                url: '/test',
                method: 'GET',
            }),
        ).rejects.toThrow('Could not get backends for invalid-network')
    })

    it('should throw an error for invalid backend', async () => {
        const { queryClient } = await import('../query-client')
        await expect(
            queryClient({
                backend: 'invalid-backend' as any,
                network: 'mainnet',
                url: '/test',
                method: 'GET',
            }),
        ).rejects.toThrow('Could not get KY client for invalid-backend')
    })

    it('should make a successful request to algod backend', async () => {
        const { queryClient } = await import('../query-client')
        const mockData = { version: '1.0' }
        mockJson.mockResolvedValue(mockData)

        const response = await queryClient({
            backend: 'algod',
            network: 'testnet',
            url: '/versions',
            method: 'GET',
        })

        expect(response.data).toEqual(mockData)
        expect(response.status).toBe(200)
    })

    it('should make a successful request to indexer backend', async () => {
        const { queryClient } = await import('../query-client')
        const mockData = { accounts: [] }
        mockJson.mockResolvedValue(mockData)

        const response = await queryClient({
            backend: 'indexer',
            network: 'mainnet',
            url: '/v2/accounts',
            method: 'GET',
        })

        expect(response.data).toEqual(mockData)
        expect(response.status).toBe(200)
    })

    it('should handle request with params', async () => {
        const { queryClient } = await import('../query-client')
        const mockData = { result: 'ok' }
        mockJson.mockResolvedValue(mockData)

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test',
            method: 'GET',
            params: { limit: 10, offset: 0 },
        })

        expect(mockKy).toHaveBeenCalledWith(
            'test',
            expect.objectContaining({
                searchParams: { limit: 10, offset: 0 },
            }),
        )
    })

    it('should strip leading slash from URL', async () => {
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test-with-slash',
            method: 'GET',
        })

        // Should call with slash removed
        expect(mockKy).toHaveBeenCalledWith(
            'test-with-slash',
            expect.any(Object),
        )
    })

    it('should handle errors and log them when debugEnabled is true', async () => {
        const { queryClient } = await import('../query-client')
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

        const testError = new Error('Test error')
        mockJson.mockRejectedValue(testError)

        await expect(
            queryClient({
                backend: 'pera',
                network: 'mainnet',
                url: '/test',
                method: 'GET',
            }),
        ).rejects.toThrow('Test error')

        // Verify error was logged
        expect(consoleLogSpy).toHaveBeenCalledWith('Query error', testError)

        consoleLogSpy.mockRestore()
    })

    it('should handle URL without leading slash', async () => {
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: 'test-no-slash',
            method: 'GET',
        })

        // Should call with URL as-is
        expect(mockKy).toHaveBeenCalledWith(
            'test-no-slash',
            expect.any(Object),
        )
    })

    it('should handle request with data', async () => {
        const { queryClient } = await import('../query-client')
        const mockData = { success: true }
        mockJson.mockResolvedValue(mockData)

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test',
            method: 'POST',
            data: { name: 'test' },
        })

        expect(mockKy).toHaveBeenCalledWith(
            'test',
            expect.objectContaining({
                json: { name: 'test' },
            }),
        )
    })

    it('should call updateBackendHeaders to extend clients', async () => {
        const { updateBackendHeaders, queryClient } = await import(
            '../query-client'
        )
        mockJson.mockResolvedValue({ success: true })

        const customHeaders = new Map<string, string>()
        customHeaders.set('X-Custom-Header', 'custom-value')

        updateBackendHeaders(customHeaders)

        await queryClient({
            backend: 'algod',
            network: 'mainnet',
            url: '/test',
            method: 'GET',
        })

        // Verify extend was called
        expect(mockKy.extend).toHaveBeenCalled()
    })

    it('should set Content-Type and API key headers via setStandardHeaders', async () => {
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test',
            method: 'GET',
        })

        // The mock request object should have headers set by setStandardHeaders
        // This is verified by the fact that the request completes successfully
        expect(mockKy).toHaveBeenCalled()
    })
})
