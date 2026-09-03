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

import ky, {
    type SearchParamsOption,
    type KyInstance,
    type BeforeRequestState,
    type BeforeRetryState,
    type BeforeErrorState,
    HTTPError,
    isHTTPError,
    isTimeoutError,
} from 'ky'
import { config, getNetworkConfig } from '@perawallet/wallet-core-config'
import type {
    RequestConfiguration,
    RequestRetryOverrides,
    ResponseConfiguration,
} from '../models/queries'
import { type Network, Networks } from '../models/base-types'
import { logger, parsePrecisionSafeJson } from '../utils'
import {
    PeraNetworkError,
    isNetworkTransportError,
    isPeraNetworkError,
} from '../errors/network'
import { PeraServiceUnavailableError } from '../errors/pera-service'

type BackendInstances = {
    algod: KyInstance
    indexer: KyInstance
    pera: KyInstance
    backup: KyInstance
}

type DiagnosticContext = {
    startTime?: number
    abortReason?: string
}

const stringifyAbortReason = (reason: unknown): string => {
    if (reason === undefined || reason === null) return 'no-reason'
    if (reason instanceof Error) return `${reason.name}: ${reason.message}`
    try {
        return String(reason)
    } catch {
        return 'unstringifiable'
    }
}

const logRequest = ({ request, options }: BeforeRequestState) => {
    const context = options.context as DiagnosticContext
    context.startTime = Date.now()

    request.signal?.addEventListener(
        'abort',
        () => {
            context.abortReason = stringifyAbortReason(request.signal?.reason)
        },
        { once: true },
    )

    logger.debug('Sending request', {
        url: request.url,
        method: request.method,
    })
}

/**
 * True for transient connectivity-class failures (timeouts, generic network
 * errors, 5xx responses) that the request layer already logged at warn. Use
 * this at higher layers (TanStack Query cache.onError, etc.) to avoid
 * double-logging the same failure at error level — those edges are flaky by
 * nature and the error-level RedBox they trigger in dev is pure noise.
 */
export const isTransientNetworkError = (error: unknown): boolean => {
    if (isPeraNetworkError(error)) return error.metadata.retryable
    // Fallback for any not-yet-normalized raw ky error.
    if (isTimeoutError(error) || isNetworkTransportError(error)) return true
    if (isHTTPError(error) && (error.response?.status ?? 0) >= 500) return true
    return false
}

// Caller-initiated aborts surface as DOMException/Error with name
// 'AbortError'. Timeouts are distinct: ky raises its own TimeoutError and
// AbortSignal.timeout() aborts carry name 'TimeoutError', so neither is
// swallowed here.
const isAbortError = (error: Error): boolean => error.name === 'AbortError'

const logError = ({ request, options, error }: BeforeErrorState): Error => {
    const context = options.context as DiagnosticContext
    const durationMs =
        context.startTime !== undefined
            ? Date.now() - context.startTime
            : undefined

    if (isHTTPError(error) && error.response?.status === 404) {
        logger.info('Resource not found', {
            url: request?.url,
            status: 404,
        })
        return error
    }

    // Aborted requests are expected lifecycle events (screen unmount, query
    // cancellation), not failures: error-level logging pollutes error
    // reporting, and in vitest the burst of abort logs emitted while a test
    // file's queries are torn down races the worker's console RPC channel
    // (EnvironmentTeardownError: "Closing rpc while onUserConsoleLog was
    // pending"). Debug keeps them visible when diagnosing locally.
    if (isAbortError(error)) {
        logger.debug('Request aborted', {
            url: request?.url,
            durationMs,
            abortReason: context.abortReason,
        })
        return error
    }

    // Timeouts and network errors are transient and expected at the edges of
    // connectivity. v1 of ky did not invoke beforeError for these cases at all,
    // so they were silently propagated to the consumer. Logging at warn keeps
    // observability without polluting error-level reporting.
    if (isTimeoutError(error) || isNetworkTransportError(error)) {
        logger.warn('Request did not complete', {
            url: request?.url,
            name: error.name,
            durationMs,
            abortReason: context.abortReason,
        })
        return error
    }

    // Rate limiting is a throttling signal, not a defect: the sync service
    // detects 429s and backs off (see hasRateLimitFailure), and deliberately
    // omits them from its own failure logging. Reporting them at error level
    // here undoes that — one rate-limited pass fans out into an error event per
    // request, which is loud enough to bury the failures worth reading.
    if (isHTTPError(error) && error.response?.status === 429) {
        logger.warn('Request rate limited', {
            url: request?.url,
            status: 429,
            durationMs,
            retryAfter: error.response.headers.get('Retry-After') ?? undefined,
        })
        return error
    }

    logger.error('Request error encountered', {
        message: error.message,
        name: error.name,
        // safely attempt to get response info if available
        status: error instanceof HTTPError ? error.response?.status : undefined,
        durationMs,
        abortReason: context.abortReason,
        details: JSON.stringify(error, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
        ),
    })
    return error
}

const logRetry = ({ request, error, retryCount }: BeforeRetryState) => {
    logger.debug('Retrying request', {
        url: request.url,
        retryCount,
        errorMessage: error.message,
    })
}

const createFetchClient = (clients: Map<string, BackendInstances>) => {
    return async <TData, TVariables = unknown>(
        requestConfig: RequestConfiguration<TVariables>,
    ): Promise<ResponseConfiguration<TData>> => {
        if (!requestConfig.url) {
            throw new Error('URL is required')
        }

        ensureClientsBuilt()

        const backends = clients.get(requestConfig.network)

        if (!backends) {
            throw new Error(
                'Could not get backends for ' + requestConfig.network,
            )
        }

        const client = backends[requestConfig.backend]

        if (!client) {
            throw new Error(
                'Could not get KY client for ' + requestConfig.backend,
            )
        }

        // Refuse before ky is invoked, not in a `beforeRequest` hook: ky
        // builds the `Request` in its constructor, so a prefix-less client hits
        // `new Request('v1/assets/')` first and a spec-compliant fetch throws a
        // bare `TypeError: Failed to parse URL`. That would normalize into a
        // generic PeraNetworkError('unknown') — the exact outcome this typed
        // error exists to avoid.
        if (
            requestConfig.backend === 'pera' &&
            networksWithoutPeraBackend.has(requestConfig.network)
        ) {
            throw new PeraServiceUnavailableError(requestConfig.network)
        }

        try {
            const path = requestConfig.url.startsWith('/')
                ? requestConfig.url.slice(1)
                : requestConfig.url

            const response = await client(path, {
                searchParams: requestConfig.params as SearchParamsOption,
                method: requestConfig.method,
                ...(requestConfig.body !== undefined
                    ? { body: requestConfig.body }
                    : { json: requestConfig.data }),
                signal: requestConfig.signal,
                headers: requestConfig.headers,
                ...(requestConfig.timeout !== undefined
                    ? { timeout: requestConfig.timeout }
                    : {}),
                ...(requestConfig.retry !== undefined
                    ? { retry: requestConfig.retry }
                    : {}),
            })

            logger.debug('Received response', {
                status: response.status,
                url: response.url,
            })

            let data: TData
            const responseType = requestConfig.responseType ?? 'json'

            switch (responseType) {
                case 'text': {
                    data = (await response.text()) as unknown as TData
                    break
                }
                case 'blob': {
                    data = (await response.blob()) as unknown as TData
                    break
                }
                case 'arraybuffer': {
                    data = (await response.arrayBuffer()) as unknown as TData
                    break
                }
                case 'json':
                default: {
                    // ky's response.json() pipes through JSON.parse()
                    // unconditionally, which throws "SyntaxError: Unexpected
                    // end of input" on 204 No Content and 200-with-empty-body
                    // responses. Read as text and only parse when there's
                    // real content — trim covers whitespace-only bodies too.
                    //
                    // parsePrecisionSafeJson (not bare JSON.parse): uint64
                    // ids above 2^53 - 1 must surface as strings instead of
                    // being silently rounded — see `uint64IdSchema`.
                    const text = await response.text()
                    data = (
                        text.trim() ? parsePrecisionSafeJson(text) : undefined
                    ) as TData
                    break
                }
            }

            return {
                data,
                status: response.status,
                statusText: response.statusText,
            }
        } catch (error) {
            if (config.debugEnabled) {
                console.log('Query error', error)
            }
            // Caller-initiated aborts must keep their identity so TanStack
            // Query's cancellation handling still recognizes them.
            if (error instanceof Error && error.name === 'AbortError') {
                throw error
            }
            throw await PeraNetworkError.fromKyErrorWithBody(error)
        }
    }
}

const clients = new Map<Network, BackendInstances>()

const setStandardHeaders = ({ request }: BeforeRequestState) => {
    request.headers.set('Content-Type', 'application/json')

    if (config.backendAPIKey?.length) {
        request.headers.set('X-API-Key', config.backendAPIKey)
    }
}

// afterResponse intentionally empty: in ky 2.x every hook invocation calls
// `response.clone()`, which interacts badly with Expo SDK 56's winter fetch
// (its FetchResponse.clone tees the body and then ky's own cleanup cancels
// the clone branch, leaving the original body unreadable when the caller
// later calls `.text()` / `.json()`). Response status is logged inline in
// createFetchClient instead.
const standardHooks = {
    beforeRequest: [logRequest],
    afterResponse: [],
    beforeError: [logError],
    beforeRetry: [logRetry],
}

const peraRetryConfig = {
    limit: 1,
    statusCodes: [408, 413, 500, 502, 503, 504],
    afterStatusCodes: [413, 503],
    maxRetryAfter: 5000,
}

/**
 * Per-request `retry` for a POST that is safe to repeat. Deep-merges into the
 * client's config, so `statusCodes` and `maxRetryAfter` still apply.
 *
 * Both keys are load-bearing, and neither works alone:
 *
 * - `methods` — ky's default retry list is
 *   `['get','put','head','delete','options','trace']`. POST is absent, so ky
 *   rejects the retry on the method check before any error inspection.
 * - `shouldRetry` — past the method check, ky's last-resort gate for a
 *   non-HTTP, non-timeout failure is its own `isNetworkError`, which never
 *   matches React Native's plain-`Error` network failures (see
 *   {@link isNetworkTransportError}). Without this, a DNS/connect failure on a
 *   POST falls through to "unknown error, don't retry" — the one case the
 *   retry is for.
 *
 * Returns `undefined` for anything else so ky's `statusCodes` handling still
 * decides 5xx and timeouts; `false` would suppress it.
 */
export const IDEMPOTENT_POST_RETRY: RequestRetryOverrides = {
    methods: ['post'],
    shouldRetry: ({ error }) =>
        isNetworkTransportError(error) ? true : undefined,
}

const createPeraClient = (network: Network): KyInstance =>
    ky.create({
        hooks: {
            ...standardHooks,
            beforeRequest: [setStandardHeaders, ...standardHooks.beforeRequest],
        },
        prefix: getNetworkConfig(network).backendUrl,
        retry: peraRetryConfig,
    })

// Takes no network: the backup service is a single global endpoint, so every
// network's BackendInstances holds an equivalent instance.
const createBackupClient = (): KyInstance =>
    ky.create({
        hooks: {
            ...standardHooks,
            beforeRequest: [setStandardHeaders, ...standardHooks.beforeRequest],
        },
        prefix: config.backupBaseUrl,
        retry: peraRetryConfig,
    })

const createTokenHeaderClient = (
    prefix: string,
    headerName: string,
    token: string,
): KyInstance =>
    ky.create({
        hooks: {
            ...standardHooks,
            beforeRequest: [
                ({ request }) => {
                    request.headers.set('Content-Type', 'application/json')
                    if (token.length) {
                        request.headers.set(headerName, token)
                    }
                },
                ...standardHooks.beforeRequest,
            ],
        },
        prefix,
        retry: peraRetryConfig,
    })

const createChainClients = (
    network: Network,
): Pick<BackendInstances, 'algod' | 'indexer'> => {
    const { algodUrl, indexerUrl, algodToken, indexerToken } =
        getNetworkConfig(network)

    return {
        algod: createTokenHeaderClient(
            algodUrl,
            'X-Algo-API-Token',
            algodToken,
        ),
        indexer: createTokenHeaderClient(
            indexerUrl,
            'X-Indexer-API-Token',
            indexerToken,
        ),
    }
}

/**
 * Networks whose Pera `backendUrl` is empty — i.e. no Pera deployment exists
 * for them (betanet, custom). Recorded by the same pass that builds the
 * clients, from the same `getNetworkConfig` read `createPeraClient` makes, so
 * the request-path guard in `createFetchClient` can never disagree with what
 * the client was actually built against. Populated before any request can be
 * served, because both go through `ensureClientsBuilt`.
 */
const networksWithoutPeraBackend = new Set<Network>()

const buildClientsFor = (network: Network): BackendInstances => {
    if (getNetworkConfig(network).backendUrl === '') {
        networksWithoutPeraBackend.add(network)
    }

    return {
        ...createChainClients(network),
        pera: createPeraClient(network),
        backup: createBackupClient(),
    }
}

let clientsInitialized = false

// On first use, NEVER at import time: importing this module must not require
// getNetworkConfig() to resolve, since consuming packages' tests mock it as a
// bare `vi.fn()` and an eager build crashes their collection.
//
// Builds EVERY member of the Networks union, not just the one needed. Do not
// replace with a per-network build-on-miss: updateBackendHeaders /
// updateNodeEndpoints can run before any request has, and would then silently
// skip the networks nothing had requested yet.
const ensureClientsBuilt = (): void => {
    if (clientsInitialized) return
    clientsInitialized = true

    for (const network of Object.values(Networks)) {
        clients.set(network, buildClientsFor(network))
    }
}

/**
 * Rebuilds a single network's algod/indexer ky instances against new endpoints.
 * Called from a `blockchain` subscription to the custom-network config store,
 * because `shared` cannot import `blockchain`. The `pera` instance is left
 * untouched — the custom-network config only carries chain endpoints.
 *
 * Tokens are part of the endpoint, so they arrive with it and are NEVER
 * re-derived from `getNetworkConfig` here: `custom` has no baked chain config
 * (its tokens are `''` by design), so re-deriving would silently drop the ones
 * the developer entered — a token-protected node then 401s every ky-transport
 * read (indexer history, indexer asset lookups) while the AlgorandClient
 * transport, which does read the store, keeps working.
 */
export const updateNodeEndpoints = (
    network: Network,
    endpoints: {
        algodUrl: string
        indexerUrl: string
        algodToken: string
        indexerToken: string
    },
): void => {
    // Must go through the gate, not `clients.get(network)` with an early
    // return: the map is lazily populated, so a bail-on-miss would
    // silently discard an override written before that network's first request.
    ensureClientsBuilt()
    const existing = clients.get(network)
    if (!existing) return

    clients.set(network, {
        ...existing,
        algod: createTokenHeaderClient(
            endpoints.algodUrl,
            'X-Algo-API-Token',
            endpoints.algodToken,
        ),
        indexer: createTokenHeaderClient(
            endpoints.indexerUrl,
            'X-Indexer-API-Token',
            endpoints.indexerToken,
        ),
    })
}

export const updateBackendHeaders = (headers: Map<string, string>) => {
    ensureClientsBuilt()

    const applyHeaders = (instance: KyInstance): KyInstance =>
        instance.extend({
            hooks: {
                // ky merges extend hooks by concatenation onto the base
                // client's, which already ends with logRequest — re-listing
                // it here would log every request twice.
                beforeRequest: [
                    setStandardHeaders,
                    ({ request }) => {
                        headers.forEach((v, k) => {
                            request.headers.set(k, v)
                        })
                    },
                ],
                // afterResponse intentionally empty: see comment on standardHooks.
                afterResponse: [],
            },
        })

    clients.forEach((client, network) => {
        clients.set(network, {
            algod: applyHeaders(client.algod),
            indexer: applyHeaders(client.indexer),
            pera: applyHeaders(client.pera),
            backup: applyHeaders(client.backup),
        })
    })
}

export const queryClient = createFetchClient(clients)
