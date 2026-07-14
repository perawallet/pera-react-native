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

import { isHTTPError, isNetworkError, isTimeoutError } from 'ky'
import { AppError, ErrorCategory, ErrorSeverity } from './base'

/**
 * Coarse network-failure taxonomy shared across the app so UIs can say *why*
 * a request failed instead of falling back to a generic error.
 */
export type PeraNetworkErrorKind =
    | 'offline' // device/network unreachable (fetch TypeError / ky isNetworkError)
    | 'timeout' // ky TimeoutError
    | 'server' // HTTP 5xx
    | 'client' // HTTP 4xx (status preserved)
    | 'unknown' // anything else (parse errors, non-ky throwables)

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
}

/**
 * Typed representation of a network failure. Subclasses {@link AppError} so
 * existing catch-sites and `isRetryableError`/logging keep working.
 */
export class PeraNetworkError extends AppError {
    public readonly kind: PeraNetworkErrorKind
    public readonly status?: number

    constructor(
        kind: PeraNetworkErrorKind,
        { status, originalError }: PeraNetworkErrorOptions = {},
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
        if (isNetworkError(error)) {
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
}

/** Type guard for {@link PeraNetworkError}. */
export const isPeraNetworkError = (error: unknown): error is PeraNetworkError =>
    error instanceof PeraNetworkError
