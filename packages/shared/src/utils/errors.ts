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

import type { Maybe, Optional } from './types'

/**
 * Extracts the HTTP status code from an error thrown by the ky HTTP client
 * (`response.status`) or from a `PeraNetworkError`, which carries the status
 * flat and has no `response` at all. Returns undefined if the error is not an
 * HTTP error or has no status.
 *
 * Both shapes matter: the request layer normalizes ky errors into
 * `PeraNetworkError` before they reach any caller, so reading only
 * `response.status` sees a status on almost nothing.
 */
export const getHttpStatus = (error: unknown): Optional<number> => {
    if (typeof error !== 'object' || error === null) return undefined
    const { response, status } = error as {
        response?: { status?: unknown }
        status?: unknown
    }
    if (typeof response?.status === 'number') return response.status
    return typeof status === 'number' ? status : undefined
}

/** Normalizes an unknown value to an Error instance. */
export const toError = (e: unknown): Error =>
    e instanceof Error ? e : new Error(String(e))

// Base32 Algorand address, as it appears in account-scoped API paths.
const ALGORAND_ADDRESS = /[A-Z2-7]{58}/g

/**
 * One-line summary for log messages: `name status url` for an HTTP-shaped
 * error (ky's `response`/`request`), just the name otherwise. Deliberately
 * omits the error message and masks address-shaped path segments: log lines
 * reach the dev log and crash-reporter breadcrumbs, and backend messages can
 * carry addresses or user data. The error object itself belongs in the log
 * context, which is classified centrally.
 */
export const describeError = (error: unknown): string => {
    const shaped = error as {
        name?: string
        response?: { status?: number; url?: string }
        request?: { url?: string }
    }
    const url = shaped?.response?.url ?? shaped?.request?.url
    return [
        shaped?.name ?? 'Error',
        shaped?.response?.status,
        url?.replace(ALGORAND_ADDRESS, '<address>'),
    ]
        .filter(part => part !== undefined)
        .join(' ')
}

/** Asserts a value is non-null, throwing a descriptive error if it is. */
export function assertDefined<T>(value: Maybe<T>, name: string): T {
    if (value == null) {
        throw new Error(`expected ${name} to be defined`)
    }
    return value
}
