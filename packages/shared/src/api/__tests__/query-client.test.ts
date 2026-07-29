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

// Mock logger
const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    critical: vi.fn(),
}
vi.mock('../../utils', async importOriginal => ({
    ...(await importOriginal<typeof import('../../utils')>()),
    logger: mockLogger,
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
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

// Mock ky with hooks support
const { mockKy, mockJson, mockText, mockStatus, capturedHooks } = vi.hoisted(
    () => {
        const mockJson = vi.fn()
        const mockText = vi.fn()
        const mockStatus = { value: 200 }
        const capturedHooks: any = {
            beforeRequest: [],
            afterResponse: [],
            beforeError: [],
            beforeRetry: [],
        }

        const mockKy: any = vi.fn(async (path: string, options: any) => {
            // ky always provides a `context` object on hook state
            const hookOptions = { ...options, context: options.context ?? {} }
            // Execute beforeRequest hooks
            const mockRequest = {
                url: path,
                headers: new Map<string, string>(),
            }
            if (capturedHooks.beforeRequest) {
                for (const hook of capturedHooks.beforeRequest) {
                    await hook({
                        request: mockRequest,
                        options: hookOptions,
                        retryCount: 0,
                    })
                }
            }

            const response = {
                json: mockJson,
                text: mockText,
                status: mockStatus.value,
                statusText: 'OK',
            }

            // Execute afterResponse hooks
            if (capturedHooks.afterResponse) {
                for (const hook of capturedHooks.afterResponse) {
                    await hook({
                        request: mockRequest,
                        options: hookOptions,
                        response,
                        retryCount: 0,
                    })
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

        return { mockKy, mockJson, mockText, mockStatus, capturedHooks }
    },
)

// Name-based stand-ins for ky's error classifiers — enough fidelity for the
// beforeError hook branches under test.
class MockHTTPError extends Error {
    response?: { status: number }
    constructor(status: number) {
        super(`Request failed with status code ${status}`)
        this.name = 'HTTPError'
        this.response = { status }
    }
}

vi.mock('ky', () => ({
    default: mockKy,
    HTTPError: MockHTTPError,
    isHTTPError: (error: unknown) => error instanceof MockHTTPError,
    isTimeoutError: (error: unknown) =>
        error instanceof Error && error.name === 'TimeoutError',
    isNetworkError: (error: unknown) =>
        error instanceof Error && error.name === 'TypeError',
}))

describe('queryClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.values(mockLogger).forEach(mock => mock.mockClear())
        mockStatus.value = 200
        // The query-client reads JSON via response.text() so it can
        // distinguish empty-body / 204 from real JSON. Mirror json → text
        // by default so existing tests that only stub `mockJson` still work;
        // individual tests can mockReset+mockResolvedValue on mockText to
        // exercise empty-body / malformed cases.
        mockText.mockImplementation(async () => {
            const data = await mockJson()
            return data === undefined ? '' : JSON.stringify(data)
        })
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
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {})

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
        expect(mockKy).toHaveBeenCalledWith('test-no-slash', expect.any(Object))
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

    it('forwards a per-request timeout to ky when provided', async () => {
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/chart',
            method: 'GET',
            timeout: 30_000,
        })

        expect(mockKy).toHaveBeenCalledWith(
            'chart',
            expect.objectContaining({ timeout: 30_000 }),
        )
    })

    it('omits timeout so ky uses its default when none is provided', async () => {
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test',
            method: 'GET',
        })

        const options = mockKy.mock.calls.at(-1)?.[1]
        expect(options).not.toHaveProperty('timeout')
    })

    it('creates every client with an explicit capped retry config', async () => {
        vi.resetModules()
        mockKy.create.mockClear()

        await import('../query-client')

        // 2 networks × (pera + algod + indexer)
        expect(mockKy.create).toHaveBeenCalledTimes(6)
        for (const [clientConfig] of mockKy.create.mock.calls) {
            expect(clientConfig.retry).toMatchObject({ limit: 1 })
        }
    })

    it('does not re-append the request logger when extending clients', async () => {
        const { updateBackendHeaders } = await import('../query-client')

        updateBackendHeaders(new Map([['X-Custom-Header', 'custom-value']]))

        const extendConfig = mockKy.extend.mock.calls.at(-1)?.[0]
        const hookNames = extendConfig.hooks.beforeRequest.map(
            (hook: { name: string }) => hook.name,
        )
        expect(hookNames).not.toContain('logRequest')
    })

    it('should call updateBackendHeaders to extend clients', async () => {
        const { updateBackendHeaders, queryClient } =
            await import('../query-client')
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

    it('lets a per-request x-api-key override the configured default', async () => {
        // capturedHooks is a shared singleton overwritten by every `ky.create`
        // call during module load (see "does not re-append the request
        // logger" above), so it ends up holding the last-created client's
        // hooks rather than the pera client's — grab `setStandardHeaders`
        // directly off the mainnet pera client's create() call instead,
        // mirroring the resetModules + mockClear pattern used by "creates
        // every client with an explicit capped retry config".
        vi.resetModules()
        mockKy.create.mockClear()
        await import('../query-client')

        const mainnetPeraClientConfig = mockKy.create.mock.calls[0][0]
        const [setStandardHeaders] = mainnetPeraClientConfig.hooks.beforeRequest

        // A real Headers instance (not the shared mock's plain Map) so the
        // case-insensitive lookup this fix relies on is genuinely exercised.
        const request = { headers: new Headers({ 'x-api-key': 'v3-key' }) }
        setStandardHeaders({ request } as never)

        expect(request.headers.get('x-api-key')).toBe('v3-key')
    })

    it('should set Content-Type and API key headers via setStandardHeaders', async () => {
        // Same technique as "lets a per-request x-api-key override the
        // configured default" above: grab the real setStandardHeaders off
        // the mainnet pera client's create() call rather than relying on
        // capturedHooks, which only reflects the last-created client.
        vi.resetModules()
        mockKy.create.mockClear()
        await import('../query-client')

        const mainnetPeraClientConfig = mockKy.create.mock.calls[0][0]
        const [setStandardHeaders] = mainnetPeraClientConfig.hooks.beforeRequest

        const request = { headers: new Headers() }
        setStandardHeaders({ request } as never)

        expect(request.headers.get('content-type')).toBe('application/json')
        expect(request.headers.get('x-api-key')).toBe('test-api-key')
    })

    it('returns undefined data for 200 with an empty body (no SyntaxError)', async () => {
        const { queryClient } = await import('../query-client')
        mockText.mockReset()
        mockText.mockResolvedValue('')

        const response = await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/empty-success',
            method: 'GET',
        })

        expect(response.data).toBeUndefined()
        expect(response.status).toBe(200)
    })

    it('returns undefined data for 204 No Content', async () => {
        const { queryClient } = await import('../query-client')
        mockStatus.value = 204
        mockText.mockReset()
        mockText.mockResolvedValue('')

        const response = await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/no-content',
            method: 'DELETE',
        })

        expect(response.data).toBeUndefined()
        expect(response.status).toBe(204)
    })

    it('returns undefined data for whitespace-only bodies', async () => {
        const { queryClient } = await import('../query-client')
        mockText.mockReset()
        mockText.mockResolvedValue('   \n\t')

        const response = await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/whitespace-body',
            method: 'GET',
        })

        expect(response.data).toBeUndefined()
    })

    it('still surfaces malformed JSON as a parse error, normalized to PeraNetworkError', async () => {
        const { queryClient } = await import('../query-client')
        const { isPeraNetworkError } = await import('../../errors/network')
        mockText.mockReset()
        mockText.mockResolvedValue('{not valid json')

        const error = await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/broken',
            method: 'GET',
        }).catch((thrown: unknown) => thrown)

        expect(isPeraNetworkError(error)).toBe(true)
        expect((error as { kind: string }).kind).toBe('unknown')
        expect(
            (error as { originalError?: Error }).originalError,
        ).toBeInstanceOf(SyntaxError)
    })

    describe('beforeError hook (logError)', () => {
        const runBeforeError = async (error: Error) => {
            await import('../query-client')
            const [beforeError] = capturedHooks.beforeError
            return beforeError({
                request: { url: 'https://mainnet.pera.algo/v1/assets' },
                options: { context: { startTime: Date.now() } },
                error,
            })
        }

        it('logs caller-initiated aborts at debug level, not error', async () => {
            const abortError = new DOMException(
                'This operation was aborted',
                'AbortError',
            )

            const result = await runBeforeError(abortError)

            expect(result).toBe(abortError)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Request aborted',
                expect.objectContaining({
                    url: 'https://mainnet.pera.algo/v1/assets',
                }),
            )
            expect(mockLogger.error).not.toHaveBeenCalled()
            expect(mockLogger.warn).not.toHaveBeenCalled()
        })

        it('still logs unexpected errors at error level', async () => {
            const unexpectedError = new Error('boom')

            const result = await runBeforeError(unexpectedError)

            expect(result).toBe(unexpectedError)
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Request error encountered',
                expect.objectContaining({ message: 'boom' }),
            )
        })
    })
})
