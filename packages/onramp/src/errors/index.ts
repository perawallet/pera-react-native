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

import {
    AppError,
    ErrorCategory,
    isPeraNetworkError,
    type Nullable,
    type Maybe,
} from '@perawallet/wallet-core-shared'

const GENERIC_FALLBACK = 'Something went wrong. Please try again.'

/**
 * Preparing the destination account needs a sponsored transaction, and the
 * sponsor requires a device attestation token that isn't available.
 */
export class RampAttestationRequiredError extends AppError {
    constructor() {
        super('Device verification is required to prepare the account.', {
            category: ErrorCategory.UNKNOWN,
            recoverable: false,
        })
        this.name = 'RampAttestationRequiredError'
    }
}

/**
 * Source-amount limits of a quote the router refused, in the source's display
 * units. Either bound may be absent.
 */
export type RampQuoteLimits = {
    min: Nullable<Decimal>
    max: Nullable<Decimal>
}

/** The router refused a quote because the amount is below its minimum or above its maximum. */
export class RampAmountOutOfRangeError extends AppError {
    readonly bound: 'min' | 'max'
    readonly limits: RampQuoteLimits

    constructor(
        bound: 'min' | 'max',
        limits: RampQuoteLimits,
        message: string,
    ) {
        super(message, {
            category: ErrorCategory.VALIDATION,
            recoverable: true,
        })
        this.name = 'RampAmountOutOfRangeError'
        this.bound = bound
        this.limits = limits
    }
}

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
function resolvePeraApiException(error: unknown): Nullable<PeraApiException> {
    if (isPeraApiException(error)) return error
    const data = (error as Maybe<{ data?: unknown }>)?.data
    return isPeraApiException(data) ? data : null
}

// The typed network error wraps the original ky error; the parsed Pera body
// (if any) lives on the original.
function unwrapNetworkError(error: unknown): unknown {
    return isPeraNetworkError(error) ? (error.originalError ?? error) : error
}

// `fallback_message` is not always prose: a serialised dict can land in it
// verbatim, and showing "{'message': ...}" to a user is worse than a generic
// apology.
function isDisplayableMessage(message: string): boolean {
    return message.trim() !== '' && !message.trimStart().startsWith('{')
}

/** Whether the error is the router refusing the amount as below its minimum. */
export function isSourceAmountTooLowError(error: unknown): boolean {
    const raw = unwrapNetworkError(error)
    return raw instanceof RampAmountOutOfRangeError && raw.bound === 'min'
}

/** Whether the error is the router refusing the amount as above its maximum. */
export function isSourceAmountTooHighError(error: unknown): boolean {
    const raw = unwrapNetworkError(error)
    return raw instanceof RampAmountOutOfRangeError && raw.bound === 'max'
}

/**
 * The limits a refused amount came with, so the UI can offer tap-to-fix. Null
 * for any other error, or when the router named neither bound.
 */
export function resolveRampQuoteLimits(
    error: unknown,
): Nullable<RampQuoteLimits> {
    const raw = unwrapNetworkError(error)
    if (!(raw instanceof RampAmountOutOfRangeError)) return null
    const { min, max } = raw.limits
    return min === null && max === null ? null : raw.limits
}

/** The `{ error, code }` body the swap router and the sponsor route answer with. */
export type RouterErrorBody = {
    error: string
    code?: string
    source_amount_minimum?: string
    source_amount_maximum?: string
}

function isRouterErrorBody(value: unknown): value is RouterErrorBody {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>).error === 'string'
    )
}

/** The router's error body, from the error itself or the parsed body the ky client attaches. */
export function resolveRouterErrorBody(
    error: unknown,
): Nullable<RouterErrorBody> {
    const raw = unwrapNetworkError(error)
    if (isRouterErrorBody(raw)) return raw
    const data = (raw as Maybe<{ data?: unknown }>)?.data
    return isRouterErrorBody(data) ? data : null
}

const ATTESTATION_REQUIRED_MESSAGE =
    'Device verification is required to fund this account.'

/**
 * Maps any error value (Pera API exception, router error, JS Error, unknown)
 * to a human-readable message suitable for display in a toast or inline error.
 */
export function toOnrampUserMessage(error: unknown): string {
    const raw = unwrapNetworkError(error)

    if (raw instanceof RampAttestationRequiredError) {
        return ATTESTATION_REQUIRED_MESSAGE
    }

    if (raw instanceof RampAmountOutOfRangeError) {
        return raw.message
    }

    const exception = resolvePeraApiException(raw)
    if (exception) {
        return isDisplayableMessage(exception.fallback_message)
            ? exception.fallback_message
            : GENERIC_FALLBACK
    }

    const routerError = resolveRouterErrorBody(raw)
    if (routerError) {
        // The server can also reject a token it considers invalid/expired.
        if (routerError.code?.startsWith('APP_INTEGRITY_TOKEN')) {
            return ATTESTATION_REQUIRED_MESSAGE
        }
        return routerError.error
    }

    return GENERIC_FALLBACK
}
