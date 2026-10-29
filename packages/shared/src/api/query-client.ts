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
import {
    WALLET_MODES,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    config,
    getPeraDeploymentConfig,
    hasPeraService,
    peraDeploymentOf,
} from '@perawallet/wallet-core-config'
import type {
    RequestConfiguration,
    RequestRetryOverrides,
    ResponseConfiguration,
} from '../models/queries'
import { logger, parsePrecisionSafeJson } from '../utils'
import {
    PeraNetworkError,
    isNetworkTransportError,
    isPeraNetworkError,
} from '../errors/network'
import { PeraServiceUnavailableError } from '../errors/pera-service'
import {
    isIntegrityRequiredError,
    toIntegrityRequiredError,
} from '../errors/integrity'
import {
    notifyIntegrityRefused,
    readIntegrityToken,
    waitForIntegrityToken,
} from './integrity-token-provider'

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
    if (isIntegrityRequiredError(error)) return true
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
        url: request?.url,
        method: request?.method,
        durationMs,
        abortReason: context.abortReason,
        // Never JSON.stringify the error itself: ky's HTTPError carries the
        // normalized options (whose `body` is the stringified request body) as
        // an enumerable field, and pre-serialized JSON reaches the redactor as
        // an escaped string its key regex cannot match. The parsed response
        // body as a plain value gets walked and scrubbed by the logger.
        responseBody: isHTTPError(error) ? error.data : undefined,
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

const INTEGRITY_PUBLIC_PATH = /^\/?api\/v3\/public\//

// The integrity endpoints are how a token is minted, so they never wait for one.
const shouldWaitForIntegrityToken = (
    requestConfig: RequestConfiguration<unknown>,
): boolean =>
    requestConfig.backend !== 'backup' &&
    config.webIntegrityBearerEnabled &&
    !INTEGRITY_PUBLIC_PATH.test(requestConfig.url ?? '') &&
    readIntegrityToken() === null

const createFetchClient = () => {
    return async <TData, TVariables = unknown>(
        requestConfig: RequestConfiguration<TVariables>,
    ): Promise<ResponseConfiguration<TData>> => {
        if (!requestConfig.url) {
            throw new Error('URL is required')
        }

        ensureClientsBuilt()

        // clientFor refuses a target with no deployment before ky is invoked,
        // not in a `beforeRequest` hook: ky builds the `Request` in its
        // constructor, so a prefix-less client hits `new Request('v1/assets/')`
        // first and a spec-compliant fetch throws a bare `TypeError: Failed to
        // parse URL`. That would normalize into a generic
        // PeraNetworkError('unknown'), the outcome this typed error exists to
        // avoid.
        const client = clientFor(requestConfig)

        if (shouldWaitForIntegrityToken(requestConfig)) {
            await waitForIntegrityToken()
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
            logger.debug('Query error', { error })
            // Caller-initiated aborts must keep their identity so TanStack
            // Query's cancellation handling still recognizes them.
            if (error instanceof Error && error.name === 'AbortError') {
                throw error
            }
            // Only the web build's token is a credential; native keeps its errors.
            const integrityRefusal =
                requestConfig.backend === 'backup' ||
                !config.webIntegrityBearerEnabled
                    ? null
                    : toIntegrityRequiredError(error)
            if (integrityRefusal) {
                notifyIntegrityRefused(integrityRefusal)
                throw integrityRefusal
            }
            throw await PeraNetworkError.fromKyErrorWithBody(error)
        }
    }
}

// One per deployment, not per scope: every chain of a tier shares its host.
const peraClients = new Map<WalletMode, KyInstance>()
let backupClient: KyInstance | undefined

const setStandardHeaders = ({ request }: BeforeRequestState) => {
    request.headers.set('Content-Type', 'application/json')

    if (config.backendAPIKey?.length) {
        request.headers.set('X-API-Key', config.backendAPIKey)
    }

    // On web this is the only credential: the extension bakes no X-API-Key
    // (apps/browser/scripts/web-config.mjs). Absent on the first mint, which is
    // exactly how /integrity/* bootstraps without a token.
    if (config.webIntegrityBearerEnabled) {
        const integrityToken = readIntegrityToken()
        if (integrityToken) {
            request.headers.set('Authorization', `Bearer ${integrityToken}`)
        }
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

/**
 * For a POST whose side effect must not repeat, such as spending a single-use
 * token. Retried only when the request got no response at all: a timeout or a
 * 5xx may mean the server already acted, so both are refused outright rather
 * than falling through to the client's `statusCodes`.
 */
export const SINGLE_USE_POST_RETRY: RequestRetryOverrides = {
    methods: ['post'],
    shouldRetry: ({ error }) => isNetworkTransportError(error),
}

const createPeraClient = (backendUrl: string): KyInstance =>
    ky.create({
        hooks: {
            ...standardHooks,
            beforeRequest: [setStandardHeaders, ...standardHooks.beforeRequest],
        },
        prefix: backendUrl,
        retry: peraRetryConfig,
    })

// A backup write queues on the server's per-backup lock for up to 10s before
// its own work starts, so ky's 10s default gives up on writes that would land.
const BACKUP_REQUEST_TIMEOUT_MS = 60_000

// Every backup request carries a signed single-use nonce that the server
// accepts before doing any work, so replaying one after any response, a 5xx
// included, comes back 401 and reads as bad credentials. Only a request that
// got no response at all is worth a second attempt.
export const BACKUP_RETRY: RequestRetryOverrides = {
    limit: 1,
    methods: ['get', 'put', 'post', 'delete'],
    shouldRetry: ({ error }) => isNetworkTransportError(error),
}

// Takes no target: the backup service is a single global endpoint.
const createBackupClient = (): KyInstance =>
    ky.create({
        hooks: {
            ...standardHooks,
            beforeRequest: [setStandardHeaders, ...standardHooks.beforeRequest],
        },
        prefix: config.backupBaseUrl,
        retry: BACKUP_RETRY,
        timeout: BACKUP_REQUEST_TIMEOUT_MS,
    })

/**
 * Deployments with a non-empty Pera `backendUrl`. Recorded by the same pass
 * that builds the clients, from the same read `createPeraClient` is given, so
 * the request-path guard can never disagree with what a client was built
 * against.
 */
const deploymentsWithPeraBackend = new Set<WalletMode>()

const ensureClientsBuilt = (): void => {
    // On first use, NEVER at import time: importing this module must not call
    // config's getters, since consuming packages' tests mock them as bare
    // `vi.fn()`s and an eager build crashes their collection. Builds every
    // deployment so updateBackendHeaders, which can run before any request,
    // never skips one.
    if (backupClient) return
    backupClient = createBackupClient()
    for (const deployment of WALLET_MODES) {
        const { backendUrl } = getPeraDeploymentConfig(deployment)
        if (backendUrl !== '') deploymentsWithPeraBackend.add(deployment)
        peraClients.set(deployment, createPeraClient(backendUrl))
    }
}

const servedPeraClient = (
    deployment: WalletMode | undefined,
): KyInstance | undefined =>
    deployment !== undefined && deploymentsWithPeraBackend.has(deployment)
        ? peraClients.get(deployment)
        : undefined

const clientFor = (
    requestConfig: RequestConfiguration<unknown>,
): KyInstance => {
    if (requestConfig.backend === 'backup') return backupClient as KyInstance

    if (requestConfig.scope === undefined) {
        const { deployment } = requestConfig
        const client = servedPeraClient(deployment)
        if (!client) {
            throw new PeraServiceUnavailableError(
                { deployment },
                requestConfig.service,
            )
        }
        return client
    }
    const { scope } = requestConfig

    // A scope reaches the deployment holding its chain's data, and must list
    // any service it names.
    const { service } = requestConfig
    const client =
        service === undefined || hasPeraService(scope, service)
            ? servedPeraClient(peraDeploymentOf(scope))
            : undefined
    if (!client) throw new PeraServiceUnavailableError(scope, service)
    return client
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

    peraClients.forEach((client, deployment) => {
        peraClients.set(deployment, applyHeaders(client))
    })
    backupClient = applyHeaders(backupClient as KyInstance)
}

export const queryClient = createFetchClient()
