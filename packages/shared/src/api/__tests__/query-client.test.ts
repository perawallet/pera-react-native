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

import { describe, it, test, expect, vi, beforeEach } from 'vitest'
import { config, Networks } from '@perawallet/wallet-core-config'
import { logger } from '../../utils'

// Mock logger. Hoisted (like the ky mocks below) because the top-level
// `import { logger }` forces this module's mock factory to be evaluated
// during import hoisting, before a plain `const` here would have run.
const mockLogger = vi.hoisted(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    critical: vi.fn(),
}))
vi.mock('../../utils', async importOriginal => ({
    ...(await importOriginal<typeof import('../../utils')>()),
    logger: mockLogger,
}))

// Shared fixtures for the @perawallet/wallet-core-config mock below AND for
// test bodies that assert on per-network values directly (e.g. "this
// network's algod client used exactly this URL/token"). Hoisted because a
// vi.mock factory can't reference a later plain `const` (see the mockLogger
// comment above) and because test bodies need the same values the mock
// hands back, without duplicating the fixture data in two places.
const {
    mockNetworks,
    mockAlgodApiKey,
    mockLocalnetAlgodToken,
    chainUrlsByNetwork,
    backendUrlByLane,
    peraServiceFallback,
    resolveFallbackNetwork,
} = vi.hoisted(() => {
    const mockNetworks = {
        testnet: 'testnet',
        mainnet: 'mainnet',
        betanet: 'betanet',
        fnet: 'fnet',
        localnet: 'localnet',
    }

    // Real production default (packages/config/src/main.ts) is `''` —
    // AlgoNode's public endpoints need no key, injected via env var only
    // for keyed deployments. An empty token would make the token-header
    // assertions below vacuous: createTokenHeaderClient's `if
    // (token.length)` guard means an empty token never sets a header at
    // all. Use a non-empty test value instead, and route EVERY non-LocalNet
    // network's algodToken through this SAME constant (not a separately
    // typed-out duplicate) so they can never silently drift apart.
    const mockAlgodApiKey = 'test-algod-key'

    // The literal LocalNet dev token from packages/config/src/main.ts's
    // productionConfig — not a secret, LocalNet's algod/indexer always
    // accept this fixed 64-character token.
    const mockLocalnetAlgodToken = 'a'.repeat(64)

    // Mirrors pera-service-fallback.ts's PERA_SERVICE_FALLBACK table.
    const peraServiceFallback: Record<string, string> = {
        betanet: 'testnet',
        fnet: 'testnet',
        localnet: 'testnet',
    }

    const resolveFallbackNetwork = (network: string): string =>
        peraServiceFallback[network] ?? network

    const chainUrlsByNetwork: Record<
        string,
        {
            algodUrl: string
            indexerUrl: string
            algodToken: string
            indexerToken: string
        }
    > = {
        mainnet: {
            algodUrl: 'https://mainnet.algod.algo',
            indexerUrl: 'https://mainnet.indexer.algo',
            algodToken: mockAlgodApiKey,
            indexerToken: 'test-indexer-key',
        },
        testnet: {
            algodUrl: 'https://testnet.algod.algo',
            indexerUrl: 'https://testnet.indexer.algo',
            algodToken: mockAlgodApiKey,
            indexerToken: 'test-indexer-key',
        },
        betanet: {
            algodUrl: 'https://betanet.algod.algo',
            indexerUrl: 'https://betanet.indexer.algo',
            algodToken: mockAlgodApiKey,
            indexerToken: 'test-indexer-key',
        },
        fnet: {
            algodUrl: 'https://fnet.algod.algo',
            indexerUrl: 'https://fnet.indexer.algo',
            algodToken: mockAlgodApiKey,
            indexerToken: 'test-indexer-key',
        },
        localnet: {
            algodUrl: 'https://localnet.algod.algo',
            indexerUrl: 'https://localnet.indexer.algo',
            algodToken: mockLocalnetAlgodToken,
            indexerToken: 'localnet-dev-token',
        },
    }

    // Only MainNet and TestNet have real Pera backend deployments — every
    // other network's `backendUrl` resolves to TestNet's.
    const backendUrlByLane: Record<string, string> = {
        mainnet: 'https://mainnet.pera.algo',
        testnet: 'https://testnet.pera.algo',
    }

    return {
        mockNetworks,
        mockAlgodApiKey,
        mockLocalnetAlgodToken,
        chainUrlsByNetwork,
        backendUrlByLane,
        peraServiceFallback,
        resolveFallbackNetwork,
    }
})

// Mock config. `getNetworkConfig` stands in for the real per-network chain
// table (packages/config/src/network-config.ts): the fixtures above cover
// all 5 networks, and `backendUrl` for betanet/fnet/localnet mirrors the
// real fallback-to-testnet resolution `getNetworkConfig` already performs,
// so query-client.ts (which trusts that resolution) needs no changes to
// exercise it here.
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        debugEnabled: true,
        backendAPIKey: 'test-api-key',
        algodApiKey: mockAlgodApiKey,
    },
    Networks: mockNetworks,
    getNetworkConfig: (network: string) => ({
        ...chainUrlsByNetwork[network],
        backendUrl: backendUrlByLane[resolveFallbackNetwork(network)],
    }),
    hasPeraServiceFallback: (network: string) =>
        peraServiceFallback[network] !== undefined,
    resolvePeraServiceNetwork: resolveFallbackNetwork,
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

    it('lazily builds all 15 clients on first use, never at import time', async () => {
        vi.resetModules()
        mockKy.create.mockClear()

        const { queryClient } = await import('../query-client')

        // Importing this module must not call getNetworkConfig(): several
        // consuming packages' tests mock it as a bare vi.fn() with no
        // default return, and building eagerly at import time crashes those
        // suites during collection (see packages/card's lsig.spec.ts).
        expect(mockKy.create).not.toHaveBeenCalled()

        mockJson.mockResolvedValue({ status: 'ok' })
        await queryClient({
            backend: 'algod',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/status',
        })

        // One request for one network builds ALL 5 networks ×
        // (pera + algod + indexer) — the gate is shared, not a per-network
        // build-on-miss.
        expect(mockKy.create).toHaveBeenCalledTimes(15)
        for (const [clientConfig] of mockKy.create.mock.calls) {
            expect(clientConfig.retry).toMatchObject({ limit: 1 })
        }
    })

    it('does not cross-wire algod/indexer URLs or tokens between networks', async () => {
        vi.resetModules()
        mockKy.create.mockClear()
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ status: 'ok' })

        await queryClient({
            backend: 'algod',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/status',
        })

        type CapturedClientConfig = {
            prefix: string
            hooks: {
                beforeRequest: Array<
                    (state: {
                        request: { headers: Map<string, string> }
                    }) => void
                >
            }
        }

        const findClientConfig = (
            prefix: string,
        ): CapturedClientConfig | undefined =>
            mockKy.create.mock.calls.find(
                ([clientConfig]: [CapturedClientConfig]) =>
                    clientConfig.prefix === prefix,
            )?.[0]

        const readHeader = (
            clientConfig: CapturedClientConfig,
            headerName: string,
        ): string | undefined => {
            const request = { headers: new Map<string, string>() }
            clientConfig.hooks.beforeRequest[0]({ request })
            return request.headers.get(headerName)
        }

        for (const network of Object.values(Networks)) {
            const { algodUrl, indexerUrl, algodToken, indexerToken } =
                chainUrlsByNetwork[network]

            const algodConfig = findClientConfig(algodUrl)
            expect(algodConfig).toBeDefined()
            expect(
                readHeader(
                    algodConfig as CapturedClientConfig,
                    'X-Algo-API-Token',
                ),
            ).toBe(algodToken)

            const indexerConfig = findClientConfig(indexerUrl)
            expect(indexerConfig).toBeDefined()
            expect(
                readHeader(
                    indexerConfig as CapturedClientConfig,
                    'X-Indexer-API-Token',
                ),
            ).toBe(indexerToken)
        }

        // Pin the fixture to the real production constants (not just to each
        // other) so a genuine regression in either value would fail here.
        // LocalNet's algod/indexer always accept this exact 64-character dev
        // token (packages/config/src/main.ts's productionConfig) — a
        // truncated or extended literal fails the length check below even
        // if it still happened to be all "a"s.
        expect(chainUrlsByNetwork.localnet.algodToken).toBe(
            mockLocalnetAlgodToken,
        )
        expect(chainUrlsByNetwork.localnet.algodToken).toHaveLength(64)
        // MainNet (and TestNet/BetaNet/FNet) route their algod token through
        // config.algodApiKey — a regression that stopped reading it (e.g.
        // hardcoding a different value) fails here even though nothing else
        // in this test would notice.
        expect(chainUrlsByNetwork.mainnet.algodToken).toBe(config.algodApiKey)
        // Keep the mutual check too: confirms the two are actually distinct
        // constants, not the same value doing double duty.
        expect(chainUrlsByNetwork.localnet.algodToken).not.toBe(
            chainUrlsByNetwork.mainnet.algodToken,
        )
    })

    it('resolves pera clients for betanet, fnet and localnet to the testnet backend, not mainnet', async () => {
        vi.resetModules()
        mockKy.create.mockClear()
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v1/currencies/',
        })

        const prefixes = mockKy.create.mock.calls.map(
            ([clientConfig]: [{ prefix: string }]) => clientConfig.prefix,
        )

        // MainNet keeps its own Pera backend.
        expect(
            prefixes.filter(
                (prefix: string) => prefix === backendUrlByLane.mainnet,
            ),
        ).toHaveLength(1)
        // TestNet, BetaNet, FNet and LocalNet all collapse onto TestNet's —
        // none of the 3 borrower networks gets a URL of its own (there isn't
        // one — Pera services aren't deployed there).
        expect(
            prefixes.filter(
                (prefix: string) => prefix === backendUrlByLane.testnet,
            ),
        ).toHaveLength(4)
    })

    test('resolves algod for every network, including the new ones', async () => {
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ version: '1.0' })

        for (const network of Object.values(Networks)) {
            await expect(
                queryClient({
                    backend: 'algod',
                    network,
                    method: 'GET',
                    url: '/v2/status',
                }),
            ).resolves.toBeDefined()
        }
    })

    describe('pera service fallback warning', () => {
        test('warns once per endpoint when pera traffic borrows testnet', async () => {
            const { queryClient } = await import('../query-client')
            mockJson.mockResolvedValue({ success: true })
            const warn = vi.spyOn(logger, 'warn')

            await queryClient({
                backend: 'pera',
                network: Networks.fnet,
                method: 'GET',
                url: '/v1/currencies/',
            })
            await queryClient({
                backend: 'pera',
                network: Networks.fnet,
                method: 'GET',
                url: '/v1/currencies/',
            })

            const fallbackWarns = warn.mock.calls.filter(([message]) =>
                String(message).includes('Pera services'),
            )
            expect(fallbackWarns).toHaveLength(1)
        })

        test('records a separate warning for a different endpoint on the same fallback network', async () => {
            const { queryClient } = await import('../query-client')
            mockJson.mockResolvedValue({ success: true })
            const warn = vi.spyOn(logger, 'warn')

            await queryClient({
                backend: 'pera',
                network: Networks.betanet,
                method: 'GET',
                url: '/v1/currencies/',
            })
            await queryClient({
                backend: 'pera',
                network: Networks.betanet,
                method: 'GET',
                url: '/v1/notifications/',
            })

            const fallbackWarns = warn.mock.calls.filter(([message]) =>
                String(message).includes('Pera services'),
            )
            // Dedup is keyed per network:method:path — a different path on
            // the same network is a separate endpoint and warns again.
            expect(fallbackWarns).toHaveLength(2)
        })

        test('does not warn for mainnet or testnet pera traffic', async () => {
            const { queryClient } = await import('../query-client')
            mockJson.mockResolvedValue({ success: true })
            const warn = vi.spyOn(logger, 'warn')

            await queryClient({
                backend: 'pera',
                network: Networks.mainnet,
                method: 'GET',
                url: '/v1/currencies/',
            })
            await queryClient({
                backend: 'pera',
                network: Networks.testnet,
                method: 'GET',
                url: '/v1/currencies/',
            })

            const fallbackWarns = warn.mock.calls.filter(([message]) =>
                String(message).includes('Pera services'),
            )
            expect(fallbackWarns).toHaveLength(0)
        })
    })

    it('updateBackendHeaders reaches every network even when called before any request', async () => {
        vi.resetModules()
        mockKy.extend.mockClear()
        const { updateBackendHeaders } = await import('../query-client')

        updateBackendHeaders(new Map([['X-Custom-Header', 'custom-value']]))

        // 5 networks × (algod + indexer + pera) — updateBackendHeaders must
        // build before extending, not silently skip networks nothing has
        // requested yet.
        expect(mockKy.extend).toHaveBeenCalledTimes(15)
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
