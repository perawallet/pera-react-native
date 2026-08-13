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

import { isHTTPError, isNetworkError, isTimeoutError } from 'ky'
import { AppError, ErrorCategory, ErrorSeverity } from './base'
import { NoConnectionError } from './network-validation'

/**
 * Coarse network-failure taxonomy shared across the app so UIs can say *why*
 * a request failed instead of falling back to a generic error.
 */
export type PeraNetworkErrorKind =
    | 'offline' // device/network unreachable (see isNetworkTransportError)
    | 'timeout' // ky TimeoutError
    | 'server' // HTTP 5xx
    | 'client' // HTTP 4xx (status preserved)
    | 'unknown' // anything else (parse errors, non-ky throwables)

/**
 * React Native's fetch rejects with a plain `Error` — name `"Error"`, not the
 * `TypeError` that every one of ky's runtime heuristics requires — and on
 * Android it appends the Java cause after a `fetch failed:` prefix rather than
 * using one of the exact messages ky matches. So ky never wraps these in its
 * `NetworkError` and `isNetworkError` returns false for a device that is simply
 * offline. ky documents the gap on `NetworkError`: "Unrecognized runtimes may
 * produce errors that are not wrapped in NetworkError."
 *
 * Matching on message text is unpleasant, but it's the only signal RN gives us,
 * and the cost of not doing it is high: an offline request classifies as
 * `unknown`, which is non-retryable and shows the user a generic error instead
 * of "no connection".
 */
const RAW_NETWORK_ERROR_FRAGMENTS = [
    'fetch failed', // RN Android — prefix, Java cause appended
    'network request failed', // RN iOS
    'unable to resolve host', // Android DNS
    'unknownhostexception',
]

const isRawPlatformNetworkError = (error: unknown): boolean => {
    if (!(error instanceof Error) || typeof error.message !== 'string') {
        return false
    }
    const message = error.message.toLowerCase()
    return RAW_NETWORK_ERROR_FRAGMENTS.some(fragment =>
        message.includes(fragment),
    )
}

/**
 * True for a transport-level failure where the request never got a response.
 * Prefer this over ky's `isNetworkError`, which under-reports on React Native —
 * see {@link isRawPlatformNetworkError}.
 */
export const isNetworkTransportError = (error: unknown): boolean =>
    isNetworkError(error) || isRawPlatformNetworkError(error)

const RETRYABLE_BY_KIND: Record<PeraNetworkErrorKind, boolean> = {
    offline: true,
    timeout: true,
    server: true,
    client: false,
    unknown: false,
}

const SEVERITY_BY_KIND: Record<PeraNetworkErrorKind, ErrorSeverity> = {
    offline: ErrorSeverity.MEDIUM,
    timeout: ErrorSeverity.MEDIUM,
    server: ErrorSeverity.MEDIUM,
    client: ErrorSeverity.LOW,
    unknown: ErrorSeverity.MEDIUM,
}

type PeraNetworkErrorOptions = {
    status?: number
    originalError?: Error
    backendType?: string
}

/**
 * Typed representation of a network failure. Subclasses {@link AppError} so
 * existing catch-sites and `isRetryableError`/logging keep working.
 */
export class PeraNetworkError extends AppError {
    public readonly kind: PeraNetworkErrorKind
    public readonly status?: number
    /**
     * Backend-provided error discriminator (e.g. `device_already_exists`),
     * parsed from the HTTP error response body by {@link fromKyErrorWithBody}.
     * Undefined unless the body was JSON with a string `type` field.
     */
    public readonly backendType?: string

    constructor(
        kind: PeraNetworkErrorKind,
        { status, originalError, backendType }: PeraNetworkErrorOptions = {},
    ) {
        super(
            `[network:${kind}]${status !== undefined ? ` ${status}` : ''} ${originalError?.message ?? kind}`,
            {
                severity: SEVERITY_BY_KIND[kind],
                category: ErrorCategory.NETWORK,
                retryable: RETRYABLE_BY_KIND[kind],
            },
            originalError,
        )
        this.kind = kind
        this.status = status
        this.backendType = backendType
    }

    /**
     * Normalize any thrown value from the ky client into a typed error. Uses
     * ky's runtime predicates exactly as the request layer does elsewhere.
     */
    static fromKyError(error: unknown): PeraNetworkError {
        if (error instanceof PeraNetworkError) return error

        const originalError = error instanceof Error ? error : undefined

        if (isTimeoutError(error)) {
            return new PeraNetworkError('timeout', { originalError })
        }
        if (isNetworkTransportError(error)) {
            return new PeraNetworkError('offline', { originalError })
        }
        if (isHTTPError(error)) {
            const status = error.response?.status
            const kind: PeraNetworkErrorKind =
                (status ?? 0) >= 500 ? 'server' : 'client'
            return new PeraNetworkError(kind, { status, originalError })
        }
        return new PeraNetworkError('unknown', { originalError })
    }

    /**
     * Same normalization as {@link fromKyError}, but additionally attempts to
     * read the backend's error `type` off the HTTP response body (e.g. Pera 6
     * apps used `device_already_exists` to fall back from PUT to POST on
     * device registration). Body-parse failures of any kind — non-JSON body,
     * null body, missing/non-string `type` — are swallowed and the base error
     * is returned unchanged.
     *
     * NOTE: the `type` field name is an assumption pending backend
     * confirmation (see Coordination Prerequisite #1) — adjust here if the
     * backend's actual error shape differs.
     */
    static async fromKyErrorWithBody(
        error: unknown,
    ): Promise<PeraNetworkError> {
        const base = PeraNetworkError.fromKyError(error)
        if (base.backendType !== undefined) return base
        if (!isHTTPError(error)) return base
        try {
            const body: unknown = await error.response.clone().json()
            const backendType =
                typeof body === 'object' &&
                body !== null &&
                typeof (body as { type?: unknown }).type === 'string'
                    ? (body as { type: string }).type
                    : undefined
            if (backendType === undefined) return base
            return new PeraNetworkError(base.kind, {
                status: base.status,
                originalError: error instanceof Error ? error : undefined,
                backendType,
            })
        } catch {
            return base
        }
    }
}

/** Type guard for {@link PeraNetworkError}. */
export const isPeraNetworkError = (error: unknown): error is PeraNetworkError =>
    error instanceof PeraNetworkError

/**
 * True when the failure means the device has no usable connection —
 * a typed offline PeraNetworkError, the fail-fast NoConnectionError thrown
 * by the mutation policy, or a raw ky/fetch network error that was never
 * wrapped (e.g. direct third-party clients).
 */
export const isConnectivityError = (error: unknown): boolean => {
    if (isPeraNetworkError(error)) return error.kind === 'offline'
    if (error instanceof NoConnectionError) return true
    return isNetworkTransportError(error)
}

export type NetworkErrorMessageKeys = { titleKey: string; bodyKey: string }

const keysFor = (base: string): NetworkErrorMessageKeys => ({
    titleKey: `${base}.title`,
    bodyKey: `${base}.body`,
})

/**
 * Single source of truth mapping a typed network error to the i18n *keys* for
 * its title/body. Returns keys (not localized strings) so this stays i18n-free;
 * the app layer resolves them via `t()`.
 */
export const getNetworkErrorMessageKeys = (
    error: unknown,
): NetworkErrorMessageKeys => {
    if (error instanceof NoConnectionError) {
        return keysFor('errors.network.no_connection')
    }

    if (!isPeraNetworkError(error)) return keysFor('errors.general')

    switch (error.kind) {
        case 'offline': {
            return keysFor('errors.network.no_connection')
        }
        case 'timeout': {
            return keysFor('errors.network.timeout')
        }
        case 'server': {
            return keysFor('errors.api.server_error')
        }
        case 'client': {
            if (error.status === 404) return keysFor('errors.api.not_found')
            if (error.status === 401 || error.status === 403) {
                return keysFor('errors.api.unauthorized')
            }
            return keysFor('errors.api.generic')
        }
        case 'unknown':
        default: {
            return keysFor('errors.general')
        }
    }
}

/**
 * True when an error represents an HTTP 404. Understands the typed
 * {@link PeraNetworkError} and falls back to the structural `.response.status`
 * shape for any not-yet-normalized error.
 */
export const isNotFoundError = (error: unknown): boolean => {
    if (isPeraNetworkError(error)) return error.status === 404
    if (typeof error !== 'object' || error === null) return false
    return (
        (error as { response?: { status?: number } }).response?.status === 404
    )
}
