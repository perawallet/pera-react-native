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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    type ErrorMessageKeys,
} from './base'
import { isRawPlatformNetworkError } from './expected'
import { isIntegrityRequiredError } from './integrity'

/**
 * Thrown by `assertOnline` before a mutation reaches the transport, so offline
 * mutations fail fast instead of pausing.
 *
 * Deliberately a sibling of {@link PeraNetworkError}, not a `kind: 'offline'`
 * instance of it: this one is reportable (not `expected`) and is not a
 * transient failure to `isTransientNetworkError`, so the mutation cache still
 * logs it. Use {@link isConnectivityError} to test for "offline" of either kind.
 */
export class NoConnectionError extends AppError {
    constructor() {
        super('No network connection found', {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.NETWORK,
            retryable: true,
        })
    }
}

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

// Mirrors RETRYABLE_BY_KIND deliberately: a failure a retry might fix is one
// the environment caused, not our code. `client` stays reportable because a 4xx
// we sent is usually our bug.
const EXPECTED_BY_KIND: Record<PeraNetworkErrorKind, boolean> = {
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
    backendCode?: string
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
    /**
     * The machine-readable `code` of a `{ error, code }` error body (e.g.
     * `unknown_chain`), parsed by {@link fromKyErrorWithBody}.
     */
    public readonly backendCode?: string

    constructor(
        kind: PeraNetworkErrorKind,
        {
            status,
            originalError,
            backendType,
            backendCode,
        }: PeraNetworkErrorOptions = {},
    ) {
        super(
            `[network:${kind}]${status !== undefined ? ` ${status}` : ''} ${originalError?.message ?? kind}`,
            {
                severity: SEVERITY_BY_KIND[kind],
                category: ErrorCategory.NETWORK,
                retryable: RETRYABLE_BY_KIND[kind],
                expected: EXPECTED_BY_KIND[kind],
            },
            originalError,
        )
        this.kind = kind
        this.status = status
        this.backendType = backendType
        this.backendCode = backendCode
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
     * device registration) and its `code`. Body-parse failures of any kind —
     * non-JSON body, null body, neither field a string — are swallowed and
     * the base error is returned unchanged.
     *
     * NOTE: the `type` field name is an assumption pending backend
     * confirmation (see Coordination Prerequisite #1) — adjust here if the
     * backend's actual error shape differs.
     */
    static async fromKyErrorWithBody(
        error: unknown,
    ): Promise<PeraNetworkError> {
        const base = PeraNetworkError.fromKyError(error)
        if (base.backendType !== undefined || base.backendCode !== undefined)
            return base
        if (!isHTTPError(error)) return base
        try {
            // ky consumes the body into `data` before the error reaches us, so
            // the response itself is only readable for an error built by hand.
            const body: unknown =
                error.data !== undefined
                    ? error.data
                    : await error.response.clone().json()
            if (typeof body !== 'object' || body === null) return base
            const { type, code } = body as { type?: unknown; code?: unknown }
            const backendType = typeof type === 'string' ? type : undefined
            const backendCode = typeof code === 'string' ? code : undefined
            if (backendType === undefined && backendCode === undefined)
                return base
            return new PeraNetworkError(base.kind, {
                status: base.status,
                originalError: error instanceof Error ? error : undefined,
                backendType,
                backendCode,
            })
        } catch {
            return base
        }
    }
}

/** Type guard for {@link PeraNetworkError}. */
export const isPeraNetworkError = (error: unknown): error is PeraNetworkError =>
    error instanceof PeraNetworkError

const CHAIN_REFUSAL_CODES: readonly string[] = [
    'unknown_chain',
    'chain_not_enabled',
]

/**
 * A 422 refusing the chain a request names: the backend doesn't know it, or
 * hasn't switched it on yet. It switches chains on one at a time, without an
 * app release.
 */
export const isChainRefusedError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.status === 422 &&
    error.backendCode !== undefined &&
    CHAIN_REFUSAL_CODES.includes(error.backendCode)

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

export type NetworkErrorMessageKeys = ErrorMessageKeys

const GENERAL_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.general.title'),
    bodyKey: i18nKey('errors.general.body'),
}
const NO_CONNECTION_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.network.no_connection.title'),
    bodyKey: i18nKey('errors.network.no_connection.body'),
}
const TIMEOUT_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.network.timeout.title'),
    bodyKey: i18nKey('errors.network.timeout.body'),
}
const SERVER_ERROR_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.api.server_error.title'),
    bodyKey: i18nKey('errors.api.server_error.body'),
}
const NOT_FOUND_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.api.not_found.title'),
    bodyKey: i18nKey('errors.api.not_found.body'),
}
const UNAUTHORIZED_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.api.unauthorized.title'),
    bodyKey: i18nKey('errors.api.unauthorized.body'),
}
const INTEGRITY_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.integrity.unavailable.title'),
    bodyKey: i18nKey('errors.integrity.unavailable.body'),
}
const API_GENERIC_KEYS: ErrorMessageKeys = {
    titleKey: i18nKey('errors.api.generic.title'),
    bodyKey: i18nKey('errors.api.generic.body'),
}

/**
 * Single source of truth mapping a typed network error to the i18n *keys* for
 * its title/body. Returns keys (not localized strings) so this stays i18n-free;
 * the app layer resolves them via `t()`.
 */
export const getNetworkErrorMessageKeys = (
    error: unknown,
): NetworkErrorMessageKeys => {
    if (error instanceof NoConnectionError) {
        return NO_CONNECTION_KEYS
    }
    if (isIntegrityRequiredError(error)) return INTEGRITY_KEYS

    if (!isPeraNetworkError(error)) return GENERAL_KEYS

    switch (error.kind) {
        case 'offline': {
            return NO_CONNECTION_KEYS
        }
        case 'timeout': {
            return TIMEOUT_KEYS
        }
        case 'server': {
            return SERVER_ERROR_KEYS
        }
        case 'client': {
            if (error.status === 404) return NOT_FOUND_KEYS
            if (error.status === 401 || error.status === 403) {
                return UNAUTHORIZED_KEYS
            }
            return API_GENERIC_KEYS
        }
        case 'unknown':
        default: {
            return GENERAL_KEYS
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
