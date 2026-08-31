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

import { AppError } from './base'

/**
 * React Native's fetch rejects with a plain `Error` whose message is the only
 * signal that the device is offline — ky's runtime heuristics all require a
 * `TypeError`, so they never fire here. Matching on text is unpleasant and is
 * confined to this one list.
 */
const RAW_NETWORK_ERROR_FRAGMENTS = [
    'fetch failed',
    'network request failed',
    'unable to resolve host',
    'unknownhostexception',
]

export const isRawPlatformNetworkError = (error: unknown): boolean => {
    if (!(error instanceof Error) || typeof error.message !== 'string') {
        return false
    }
    const message = error.message.toLowerCase()
    return RAW_NETWORK_ERROR_FRAGMENTS.some(fragment =>
        message.includes(fragment),
    )
}

// `AbortSignal.timeout()` rejects with a DOMException named 'TimeoutError',
// which is not ky's TimeoutError class, so ky's brand-check guards miss every
// algod and indexer timeout.
const EXPECTED_ERROR_NAMES = new Set(['TimeoutError', 'AbortError'])

const readStatus = (error: unknown): number | undefined => {
    if (typeof error !== 'object' || error === null) return undefined
    const response = (error as { response?: unknown }).response
    if (typeof response !== 'object' || response === null) return undefined
    const status = (response as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
}

/**
 * True for failures caused by the environment, the OS or the user rather than
 * by our code — the ones that must not become Crashlytics non-fatals.
 *
 * Classification is driven by types we own (`ErrorMetadata.expected`) plus
 * three structural fallbacks for throwables that never reach one of our
 * classes. Deliberately never a free-form message heuristic beyond
 * {@link isRawPlatformNetworkError}: a message-matching classifier can hide a
 * real defect permanently with no visible failure mode.
 */
export const isExpectedError = (error: unknown): boolean => {
    if (error instanceof AppError) return error.metadata.expected === true

    // A native module can make `name` a throwing accessor, and this runs on
    // every error log — a throw here would cost the report it is classifying.
    try {
        if (
            error instanceof Error &&
            typeof error.name === 'string' &&
            EXPECTED_ERROR_NAMES.has(error.name)
        ) {
            return true
        }
    } catch {
        return false
    }

    if (isRawPlatformNetworkError(error)) return true

    // 5xx is an upstream outage and 429 is a throttling signal; both are
    // retryable and neither is our defect. 4xx is deliberately excluded —
    // that is where our own bad requests live.
    const status = readStatus(error)
    return status !== undefined && (status >= 500 || status === 429)
}
