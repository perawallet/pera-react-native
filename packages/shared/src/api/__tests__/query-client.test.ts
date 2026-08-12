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

// Mock logger. Hoisted (like the ky mocks below) because vi.mock factories
// are hoisted above all imports, so a plain `const` declared here (instead of
// via vi.hoisted) would not exist yet when this factory runs.
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
    mockIndexerApiKey,
    mockCustomNodeToken,
    chainUrlsByNetwork,
    backendUrlByNetwork,
} = vi.hoisted(() => {
    const mockNetworks = {
        testnet: 'testnet',
        mainnet: 'mainnet',
        betanet: 'betanet',
        custom: 'custom',
    }

    // Real production default (packages/config/src/main.ts) is `''` —
    // AlgoNode's public endpoints need no key, injected via env var only
    // for keyed deployments. An empty token would make the token-header
    // assertions below vacuous: createTokenHeaderClient's `if
    // (token.length)` guard means an empty token never sets a header at
    // all. Use a non-empty test value instead, and route every keyed
    // network's algodToken through this SAME constant (not a separately
    // typed-out duplicate) so they can never silently drift apart.
    const mockAlgodApiKey = 'test-algod-key'

    // Same reasoning as mockAlgodApiKey above, for the indexer's token.
    const mockIndexerApiKey = 'test-indexer-key'

    // `custom`'s algod/indexer tokens are runtime-provided by the
    // developer-entered custom-network store (packages/config's real
    // `custom` row is hardcoded empty), and production reads the SAME value
    // for both algodToken and indexerToken. Mirrored below by using this one
    // constant for both, so the "does not cross-wire" test below must tell
    // the algod and indexer clients apart by header NAME, not by token
    // value.
    const mockCustomNodeToken = 'custom-node-token'

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
            indexerToken: mockIndexerApiKey,
        },
        testnet: {
            algodUrl: 'https://testnet.algod.algo',
            indexerUrl: 'https://testnet.indexer.algo',
            algodToken: mockAlgodApiKey,
            indexerToken: mockIndexerApiKey,
        },
        betanet: {
            algodUrl: 'https://betanet.algod.algo',
            indexerUrl: 'https://betanet.indexer.algo',
            algodToken: mockAlgodApiKey,
            indexerToken: mockIndexerApiKey,
        },
        // Deliberately NOT 'https://custom.algod.algo': the
        // "updateNodeEndpoints" tests below reuse that exact literal for an
        // unrelated override scenario, and findClientConfig matches by URL —
        // colliding would make it find whichever client was built first
        // instead of the one each test actually means to inspect.
        custom: {
            algodUrl: 'https://custom-node.algod.algo',
            indexerUrl: 'https://custom-node.indexer.algo',
            algodToken: mockCustomNodeToken,
            indexerToken: mockCustomNodeToken,
        },
    }

    // Only MainNet and TestNet have real Pera backend deployments. BetaNet
    // and `custom` are absent from this table entirely — mirrored below by
    // getNetworkConfig's `?? ''`, which is exactly what createPeraClient
    // branches on.
    const backendUrlByNetwork: Record<string, string> = {
        mainnet: 'https://mainnet.pera.algo',
        testnet: 'https://testnet.pera.algo',
    }

    return {
        mockNetworks,
        mockAlgodApiKey,
        mockIndexerApiKey,
        mockCustomNodeToken,
        chainUrlsByNetwork,
        backendUrlByNetwork,
    }
})

// Mock config. `getNetworkConfig` stands in for the real per-network chain
// table (packages/config/src/network-config.ts): the fixtures above cover
// all 4 networks, and betanet/custom's `backendUrl` is empty — mirroring the
// real per-network table's empty rows — rather than a value borrowed from
// another network.
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        debugEnabled: true,
        backendAPIKey: 'test-api-key',
        algodApiKey: mockAlgodApiKey,
        indexerApiKey: mockIndexerApiKey,
        // Not per-network: the backup service is one global endpoint, so every
        // network's `backup` client is built against this same prefix.
        backupBaseUrl: 'https://backup.test.perawallet.app/',
    },
    Networks: mockNetworks,
    // Mirrors the real per-network table: betanet/custom carry an EMPTY
    // backendUrl rather than a borrowed one, which is exactly what
    // createPeraClient branches on.
    getNetworkConfig: (network: string) => ({
        ...chainUrlsByNetwork[network],
        backendUrl: backendUrlByNetwork[network] ?? '',
    }),
    isPeraBackedNetwork: (network: string) =>
        backendUrlByNetwork[network] !== undefined,
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
            // Every client is built the same way now — including the `pera`
            // client of a network with no deployment, whose prefix is simply
            // `''`. Nothing ever calls that one: createFetchClient throws a
            // PeraServiceUnavailableError before it reaches ky, which is what
            // "mockKy was never called" asserts below.
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

    it('lazily builds all 16 clients on first use, never at import time', async () => {
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

        // One request for one network builds ALL 4 networks ×
        // (pera + algod + indexer + backup) — the gate is shared, not a
        // per-network build-on-miss.
        expect(mockKy.create).toHaveBeenCalledTimes(16)

        // Every client is built uniformly — a `prefix` (empty for betanet's
        // and custom's `pera` slot, which is never invoked) and the same
        // retry policy. No client is special-cased at construction time; the
        // "no Pera deployment" refusal lives on the request path instead.
        for (const [clientConfig] of mockKy.create.mock.calls) {
            expect(clientConfig).toMatchObject({ retry: { limit: 1 } })
            expect(clientConfig.prefix).toBeTypeOf('string')
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
        expect(chainUrlsByNetwork.custom.algodToken).toBe(mockCustomNodeToken)
        // MainNet (and TestNet/BetaNet) route their algod token through
        // config.algodApiKey — a regression that stopped reading it (e.g.
        // hardcoding a different value) fails here even though nothing else
        // in this test would notice.
        expect(chainUrlsByNetwork.mainnet.algodToken).toBe(config.algodApiKey)
        // Keep the mutual check too: confirms the two are actually distinct
        // constants, not the same value doing double duty.
        expect(chainUrlsByNetwork.custom.algodToken).not.toBe(
            chainUrlsByNetwork.mainnet.algodToken,
        )

        // Same pins for the indexer token. Unlike algod, `custom`'s indexer
        // token is NOT distinct from its algod token — production reads both
        // from the SAME developer-entered custom-network store value — so
        // there is no mutual-inequality check to keep here; asserting
        // equality to the one real constant is the correct model, not a
        // weakening.
        expect(chainUrlsByNetwork.custom.indexerToken).toBe(mockCustomNodeToken)
        expect(chainUrlsByNetwork.mainnet.indexerToken).toBe(
            config.indexerApiKey,
        )

        // Now that custom's algod and indexer tokens are equal (mirroring
        // production), a token-VALUE comparison alone can no longer tell the
        // two clients apart for that network. Assert the header NAME each
        // one actually sets instead, which stays distinct regardless of
        // token equality — this is what would catch the algod and indexer
        // clients being swapped (wrong URL/role paired with the other's
        // header name) even when their token values happen to match.
        const customAlgodConfig = findClientConfig(
            chainUrlsByNetwork.custom.algodUrl,
        ) as CapturedClientConfig
        const customAlgodRequest = { headers: new Map<string, string>() }
        customAlgodConfig.hooks.beforeRequest[0]({
            request: customAlgodRequest,
        })
        expect(customAlgodRequest.headers.has('X-Algo-API-Token')).toBe(true)
        expect(customAlgodRequest.headers.has('X-Indexer-API-Token')).toBe(
            false,
        )

        const customIndexerConfig = findClientConfig(
            chainUrlsByNetwork.custom.indexerUrl,
        ) as CapturedClientConfig
        const customIndexerRequest = { headers: new Map<string, string>() }
        customIndexerConfig.hooks.beforeRequest[0]({
            request: customIndexerRequest,
        })
        expect(customIndexerRequest.headers.has('X-Indexer-API-Token')).toBe(
            true,
        )
        expect(customIndexerRequest.headers.has('X-Algo-API-Token')).toBe(false)
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

    test('a network with no Pera deployment throws instead of reaching a backend', async () => {
        // The failure must happen BEFORE ky is invoked at all: asserting
        // mockKy was never called is what distinguishes "refused to send"
        // from "sent somewhere and failed" — and, since real ky would build
        // the Request synchronously in its constructor, it is also what stops
        // the typed error degrading into a URL-parse TypeError.
        mockKy.mockClear()

        const { queryClient } = await import('../query-client')
        // Dynamically imported (not the file's static top-level import):
        // several earlier tests call vi.resetModules(), which makes a later
        // *static* import's class reference stale — the error queryClient
        // throws would be an instance of a DIFFERENT (freshly re-evaluated)
        // PeraServiceUnavailableError class, failing toBeInstanceOf below
        // for reasons unrelated to the behavior under test. Importing here
        // guarantees both come from the same module registry snapshot.
        const {
            PeraServiceUnavailableError: FreshPeraServiceUnavailableError,
        } = await import('../../errors/pera-service')

        await expect(
            queryClient({
                backend: 'pera',
                network: 'betanet',
                method: 'GET',
                url: '/v1/assets/',
            }),
        ).rejects.toBeInstanceOf(FreshPeraServiceUnavailableError)

        expect(mockKy).not.toHaveBeenCalled()
    })

    test('Pera-backed networks still reach their own backend', async () => {
        mockKy.mockClear()
        mockJson.mockResolvedValue({ results: [] })

        const { queryClient } = await import('../query-client')

        await queryClient({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: '/v1/assets/',
        })

        expect(mockKy).toHaveBeenCalled()
    })

    it('updateBackendHeaders reaches every network even when called before any request', async () => {
        vi.resetModules()
        mockKy.extend.mockClear()
        const { updateBackendHeaders } = await import('../query-client')

        updateBackendHeaders(new Map([['X-Custom-Header', 'custom-value']]))

        // 4 networks × (algod + indexer + pera + backup) —
        // updateBackendHeaders must build before extending, not silently skip
        // networks nothing has requested yet.
        expect(mockKy.extend).toHaveBeenCalledTimes(16)
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

    describe('updateNodeEndpoints', () => {
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

        it('rebuilds algod/indexer for the given network against the new endpoints and tokens, even when called before any request', async () => {
            vi.resetModules()
            mockKy.create.mockClear()
            const { updateNodeEndpoints } = await import('../query-client')

            updateNodeEndpoints(Networks.mainnet, {
                algodUrl: 'https://overridden.algod.algo',
                indexerUrl: 'https://overridden.indexer.algo',
                algodToken: mockAlgodApiKey,
                indexerToken: mockIndexerApiKey,
            })

            // 16 from ensureClientsBuilt (4 networks x
            // algod+indexer+pera+backup) + 2 for the rebuilt algod/indexer of
            // the overridden network. 19 would mean pera got needlessly
            // rebuilt too; fewer than 18 would mean the override was silently
            // dropped because the ensureClientsBuilt gate never ran
            // (clients.get would have returned undefined on an empty,
            // never-built map).
            expect(mockKy.create).toHaveBeenCalledTimes(18)

            const algodConfig = findClientConfig(
                'https://overridden.algod.algo',
            )
            expect(algodConfig).toBeDefined()
            expect(
                readHeader(
                    algodConfig as CapturedClientConfig,
                    'X-Algo-API-Token',
                ),
            ).toBe(mockAlgodApiKey)

            const indexerConfig = findClientConfig(
                'https://overridden.indexer.algo',
            )
            expect(indexerConfig).toBeDefined()
            expect(
                readHeader(
                    indexerConfig as CapturedClientConfig,
                    'X-Indexer-API-Token',
                ),
            ).toBe(mockIndexerApiKey)
        })

        // The `custom` network is the case that matters: getNetworkConfig
        // returns empty tokens for it by design (its chain values live in the
        // custom-network store, which `config` cannot read), so re-deriving
        // them here instead of taking them from the caller silently drops
        // them. Asserted on mainnet for simplicity — the discriminator
        // (passed token differs from the baked one) is the same regardless
        // of which network's override this exercises.
        it('takes the tokens from the caller, not from the baked chain config', async () => {
            vi.resetModules()
            mockKy.create.mockClear()
            const { updateNodeEndpoints } = await import('../query-client')

            updateNodeEndpoints(Networks.mainnet, {
                algodUrl: 'https://custom.algod.algo',
                indexerUrl: 'https://custom.indexer.algo',
                algodToken: 'a'.repeat(64),
                indexerToken: 'store-indexer-token',
            })

            const algodConfig = findClientConfig('https://custom.algod.algo')
            expect(algodConfig).toBeDefined()
            expect(
                readHeader(
                    algodConfig as CapturedClientConfig,
                    'X-Algo-API-Token',
                ),
            ).toBe('a'.repeat(64))

            const indexerConfig = findClientConfig(
                'https://custom.indexer.algo',
            )
            expect(indexerConfig).toBeDefined()
            expect(
                readHeader(
                    indexerConfig as CapturedClientConfig,
                    'X-Indexer-API-Token',
                ),
            ).toBe('store-indexer-token')
        })

        it('does not rebuild other networks', async () => {
            vi.resetModules()
            mockKy.create.mockClear()
            const { updateNodeEndpoints } = await import('../query-client')

            updateNodeEndpoints(Networks.mainnet, {
                algodUrl: 'https://overridden.algod.algo',
                indexerUrl: 'https://overridden.indexer.algo',
                algodToken: mockAlgodApiKey,
                indexerToken: mockIndexerApiKey,
            })

            // TestNet's algod client was only ever built once, by
            // ensureClientsBuilt — overriding MainNet must not rebuild it.
            const testnetAlgodCalls = mockKy.create.mock.calls.filter(
                ([clientConfig]: [CapturedClientConfig]) =>
                    clientConfig.prefix === chainUrlsByNetwork.testnet.algodUrl,
            )
            expect(testnetAlgodCalls).toHaveLength(1)
        })

        it('smoke check: the replaced client map entry does not break a subsequent request', async () => {
            // Only proves updateNodeEndpoints leaves `clients` in a shape
            // queryClient can still look up (right backend keys present,
            // nothing set to undefined) — NOT that the request actually used
            // the new prefix/token. `mockKy.create` always returns the same
            // `mockKy` singleton regardless of the `prefix` it was configured
            // with, and the request function it returns never reads `prefix`
            // either, so this call can't observe which endpoint was actually
            // targeted. The two tests above cover the real endpoint/token
            // values, via the captured `mockKy.create` config instead.
            const { updateNodeEndpoints, queryClient } =
                await import('../query-client')
            mockJson.mockResolvedValue({ version: '1.0' })

            updateNodeEndpoints(Networks.mainnet, {
                algodUrl: 'https://overridden.algod.algo',
                indexerUrl: 'https://overridden.indexer.algo',
                algodToken: mockAlgodApiKey,
                indexerToken: mockIndexerApiKey,
            })

            await expect(
                queryClient({
                    backend: 'algod',
                    network: Networks.mainnet,
                    method: 'GET',
                    url: '/v2/status',
                }),
            ).resolves.toBeDefined()
        })
    })

    it('should set Content-Type and API key headers via setStandardHeaders', async () => {
        // capturedHooks is a shared singleton overwritten by every `ky.create`
        // call (see "does not re-append the request logger" above), so it ends
        // up holding the last-created client's hooks rather than the pera
        // client's — grab the real `setStandardHeaders` directly off the
        // mainnet pera client's create() call instead.
        //
        // Two things this must NOT assume, both since the runtime-network work
        // made client construction lazy:
        //  - that importing the module creates any client at all. It does not
        //    ("NEVER at module import time" — see `ensureClientsBuilt`), so a
        //    request has to run first to trigger the build.
        //  - that the pera client is `mock.calls[0]`. `ensureClientsBuilt`
        //    builds every network's algod/indexer/pera in one pass, so the
        //    client is located by its prefix, not by call order.
        type PeraClientConfig = {
            prefix: string
            hooks: {
                beforeRequest: Array<
                    (state: { request: { headers: Headers } }) => void
                >
            }
        }

        vi.resetModules()
        mockKy.create.mockClear()
        const { queryClient } = await import('../query-client')
        mockJson.mockResolvedValue({ success: true })

        await queryClient({
            backend: 'pera',
            network: 'mainnet',
            url: '/test',
            method: 'GET',
        })

        const mainnetPeraClientConfig = mockKy.create.mock.calls.find(
            ([clientConfig]: [PeraClientConfig]) =>
                clientConfig.prefix === 'https://mainnet.pera.algo',
        )?.[0] as PeraClientConfig | undefined

        expect(mainnetPeraClientConfig).toBeDefined()

        const [setStandardHeaders] = (
            mainnetPeraClientConfig as PeraClientConfig
        ).hooks.beforeRequest

        const request = { headers: new Headers() }
        setStandardHeaders({ request })

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
