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

import { LogicError } from '@algorandfoundation/algokit-utils/types/logic-error'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AlgodError } from './AlgodError'
import { parseAlgodMessage } from './parseAlgodMessage'

/**
 * Converts any error thrown from algokit-utils / algosdk / the algod node into
 * a structured {@link AlgodError}. Idempotent: passing an existing AlgodError
 * returns it unchanged. Never throws.
 */
export const toAlgodError = (err: unknown): AlgodError => {
    if (err instanceof AlgodError) return err
    if (err instanceof LogicError) return fromLogicError(err)

    const maybeError = err instanceof Error ? err : undefined

    if (maybeError && isApiErrorLike(err)) return fromApiError(err, maybeError)
    if (maybeError && isFetchTypeError(maybeError)) {
        return new AlgodError('network_unavailable', {}, maybeError)
    }
    // Checked independently of `maybeError`: AbortSignal.timeout(...) throws a
    // DOMException which, in some runtimes (e.g. jsdom), is not `instanceof
    // Error` despite being structurally Error-shaped (name/message/stack).
    if (isAbortError(err)) {
        return new AlgodError('network_unavailable', {}, err)
    }

    if (maybeError) {
        const parsed = parseAlgodMessage(maybeError.message)
        if (parsed) {
            return new AlgodError(
                parsed.code,
                parsed.params as never,
                maybeError,
            )
        }
        return new AlgodError(
            'unknown_node_error',
            { raw: maybeError.message || String(maybeError) },
            maybeError,
        )
    }

    return new AlgodError('unknown_node_error', { raw: stringifyUnknown(err) })
}

const fromLogicError = (err: LogicError): AlgodError<'logic_error'> =>
    new AlgodError(
        'logic_error',
        {
            txId: err.led?.txId,
            pc: err.led?.pc,
            msg: err.led?.msg ?? err.message,
            tealLine: err.teal_line,
        },
        err,
    )

// HTTP errors from the algod client. algosdk v3's `HTTPClient` rebuilds every
// transport error before rethrowing: it decodes the body into `response.text`
// and copies `response.status` to a top-level numeric `status` — it has NO
// `url`, which is why the previous guard (a v10 `ApiError` leftover requiring
// `url`) silently killed the 5xx path after the algosdk v3 migration.
// Neither error type is publicly exported, so duck-type on
// `status` + `response` together: `status` alone also matches unrelated Error
// subclasses carrying an HTTP status (e.g. the Pera backend's
// PeraNetworkError), which must NOT classify as algod network errors.
interface ApiErrorLike {
    status: number
    response: { text?: string }
}

const isApiErrorLike = (err: unknown): err is ApiErrorLike & Error => {
    if (!(err instanceof Error)) return false
    const candidate = err as Partial<ApiErrorLike>
    return (
        typeof candidate.status === 'number' &&
        typeof candidate.response === 'object' &&
        candidate.response !== null
    )
}

const fromApiError = (err: ApiErrorLike, cause: Error): AlgodError => {
    // A node's rejection text (4xx) lives in the response body and, for algosdk
    // v3, is also appended to the error message. parseAlgodMessage substring-
    // matches, so parse whichever the client populated before falling back to
    // the transport-level code.
    const bodyMessage = extractBodyMessage(err.response.text) ?? cause.message
    const parsed = parseAlgodMessage(bodyMessage)
    if (parsed) {
        return new AlgodError(parsed.code, parsed.params as never, cause)
    }

    if (err.status >= 500 || err.status === 0) {
        return new AlgodError(
            'network_unavailable',
            { status: err.status },
            cause,
        )
    }

    return new AlgodError('unknown_node_error', { raw: bodyMessage }, cause)
}

// algod bodies arrive as the raw decoded text, usually `{"message":"..."}` —
// unwrap the inner message so `raw` params don't carry the JSON wrapper.
// Empty bodies normalize to undefined so callers can `??` a fallback.
const extractBodyMessage = (body: unknown): Optional<string> => {
    if (typeof body === 'string') {
        return messageFromObject(tryParseJson(body)) ?? (body || undefined)
    }
    return messageFromObject(body)
}

const messageFromObject = (value: unknown): Optional<string> => {
    if (value && typeof value === 'object' && 'message' in value) {
        const m = (value as { message?: unknown }).message
        if (typeof m === 'string' && m) return m
    }
    return undefined
}

const tryParseJson = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

// Catches React Native's `TypeError: Network request failed` and Node's
// `fetch failed` style errors that don't carry a status code.
const isFetchTypeError = (err: Error): boolean => {
    if (!(err instanceof TypeError)) return false
    const m = err.message.toLowerCase()
    return (
        m.includes('network request failed') ||
        m.includes('fetch failed') ||
        m.includes('failed to fetch')
    )
}

// Thrown by AbortSignal.timeout(...) / AbortController.abort() as a
// DOMException (`name === 'TimeoutError'` / `'AbortError'`). Duck-typed on
// `name` rather than gated behind `instanceof Error` because DOMException is
// not always `instanceof Error` (e.g. jsdom), even though it is structurally
// Error-shaped. These are transient transport failures and must classify as
// the retryable network_unavailable code, not the terminal
// unknown_node_error fallback.
const isAbortError = (err: unknown): err is Error => {
    if (typeof err !== 'object' || err === null) return false
    const name = (err as { name?: unknown }).name
    return name === 'AbortError' || name === 'TimeoutError'
}

const stringifyUnknown = (err: unknown): string => {
    if (err === undefined) return 'undefined'
    if (err === null) return 'null'
    try {
        return typeof err === 'string' ? err : JSON.stringify(err)
    } catch {
        return String(err)
    }
}
