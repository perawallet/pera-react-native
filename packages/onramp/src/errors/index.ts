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

import type { Decimal } from 'decimal.js'

import { FeeDelegationAttestationRequiredError } from '@perawallet/wallet-core-fee-delegation'
import {
    isPeraNetworkError,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import { parseRampAmount } from '../quotes'

const GENERIC_FALLBACK = 'Something went wrong. Please try again.'

// Shape of a Pera API exception response body, ported from the web
// onramp peraApi.exception.types.ts.
interface PeraApiException {
    type: string
    fallback_message: string
    detail: Record<string, unknown>
}

function isPeraApiException(value: unknown): value is PeraApiException {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>).type === 'string' &&
        typeof (value as Record<string, unknown>).fallback_message ===
            'string' &&
        typeof (value as Record<string, unknown>).detail === 'object' &&
        (value as Record<string, unknown>).detail !== null
    )
}

// The shared ky client throws an HTTPError that carries the parsed Pera error
// body on `.data`. Resolve the exception from either the error itself (if it's
// already the body) or that `.data` wrapper.
function resolvePeraApiException(error: unknown): PeraApiException | null {
    if (isPeraApiException(error)) return error
    const data = (error as { data?: unknown } | null | undefined)?.data
    return isPeraApiException(data) ? data : null
}

// The typed network error wraps the original ky error; the parsed Pera body
// (if any) lives on the original.
function unwrapNetworkError(error: unknown): unknown {
    return isPeraNetworkError(error) ? (error.originalError ?? error) : error
}

type SourceAmountLeaf = {
    message?: string
    min_amount?: string
    max_amount?: string
}

// The SourceAmountIsTooLow detail carries a single-quoted JSON payload in
// non_field_errors[0]; normalise the quotes before parsing. Null when the
// leaf is absent or malformed.
function parseSourceAmountLeaf(
    exception: PeraApiException,
): Nullable<SourceAmountLeaf> {
    try {
        const nonFieldErrors = (exception.detail as Record<string, unknown>)
            .non_field_errors

        if (
            Array.isArray(nonFieldErrors) &&
            typeof nonFieldErrors[0] === 'string'
        ) {
            const normalised = (nonFieldErrors[0] as string).replace(/'/g, '"')
            return JSON.parse(normalised) as SourceAmountLeaf
        }
    } catch {
        // fall through to null
    }

    return null
}

function parseSourceAmountIsTooLow(exception: PeraApiException): string {
    const leaf = parseSourceAmountLeaf(exception)

    if (leaf) {
        const parts: string[] = []

        if (leaf.message) {
            parts.push(leaf.message)
        }

        if (leaf.min_amount) {
            parts.push(`Minimum amount: ${leaf.min_amount}`)
        }

        if (leaf.max_amount) {
            parts.push(`Maximum amount: ${leaf.max_amount}`)
        }

        if (parts.length > 0) {
            return parts.join(' ')
        }
    }

    return exception.fallback_message || GENERIC_FALLBACK
}

/**
 * Provider source-amount limits extracted from a SourceAmountIsTooLow quote
 * error, in the pair's source (fiat) display units. Either bound may be
 * absent.
 */
export type RampQuoteLimits = {
    min: Nullable<Decimal>
    max: Nullable<Decimal>
}

/**
 * Extracts structured min/max limits from a SourceAmountIsTooLow quote error
 * so the UI can offer tap-to-fix. Returns null for any other error, or when
 * no limit can be parsed out of the payload.
 */
export function resolveRampQuoteLimits(
    error: unknown,
): Nullable<RampQuoteLimits> {
    const exception = resolvePeraApiException(unwrapNetworkError(error))
    if (!exception || exception.type !== 'SourceAmountIsTooLow') return null

    const leaf = parseSourceAmountLeaf(exception)
    if (!leaf) return null

    const min = leaf.min_amount ? parseRampAmount(leaf.min_amount) : null
    const max = leaf.max_amount ? parseRampAmount(leaf.max_amount) : null
    return min === null && max === null ? null : { min, max }
}

// Bun-backend error body (e.g. the fee-delegation route): `{ error, code }`.
// Resolved from the error itself or the parsed body the ky client attaches.
type BunApiError = { error: string; code?: string }

function isBunApiError(value: unknown): value is BunApiError {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>).error === 'string'
    )
}

function resolveBunApiError(error: unknown): BunApiError | null {
    if (isBunApiError(error)) return error
    const data = (error as { data?: unknown } | null | undefined)?.data
    return isBunApiError(data) ? data : null
}

const ATTESTATION_REQUIRED_MESSAGE =
    'Device verification is required to fund this account.'

/**
 * Maps any error value (Pera API exception, bun API error, JS Error, unknown)
 * to a human-readable message suitable for display in a toast or inline error.
 *
 * For SourceAmountIsTooLow errors the message includes the min/max limits
 * extracted from the API response payload.
 */
export function toOnrampUserMessage(error: unknown): string {
    const raw = unwrapNetworkError(error)

    // The fee-delegation flow throws before the request when no device
    // attestation token is available; surface it with onramp wording.
    if (raw instanceof FeeDelegationAttestationRequiredError) {
        return ATTESTATION_REQUIRED_MESSAGE
    }

    const exception = resolvePeraApiException(raw)
    if (exception) {
        if (exception.type === 'SourceAmountIsTooLow') {
            return parseSourceAmountIsTooLow(exception)
        }
        return exception.fallback_message || GENERIC_FALLBACK
    }

    const bunError = resolveBunApiError(raw)
    if (bunError) {
        // The server can also reject a token it considers invalid/expired.
        if (bunError.code?.startsWith('APP_INTEGRITY_TOKEN')) {
            return ATTESTATION_REQUIRED_MESSAGE
        }
        return bunError.error
    }

    return GENERIC_FALLBACK
}
