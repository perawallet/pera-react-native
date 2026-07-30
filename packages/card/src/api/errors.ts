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

/** Normalized view of a card/Baanx API failure, used to attribute it to a field. */
export type CardApiError = {
    /** HTTP status code, when the failure carried an HTTP response. */
    status?: number
    /** Machine-readable error code parsed from the response body, if present. */
    code?: string
    /** Human-readable message parsed from the response body, if present. */
    message?: string
}

type BodyReadable = {
    text?: () => Promise<string>
    json?: () => Promise<unknown>
}

type JsonReadable = BodyReadable & {
    clone?: () => BodyReadable
    status?: unknown
}

/** Safely pulls the `response` object off an unknown thrown value. */
const getResponse = (error: unknown): JsonReadable | undefined => {
    if (typeof error !== 'object' || error === null) return undefined
    const response = (error as { response?: unknown }).response
    return typeof response === 'object' && response !== null
        ? (response as JsonReadable)
        : undefined
}

/**
 * HTTP status off the error's `response`, when present. Inlined (rather than
 * importing the shared helper) so this normalizer stays self-contained and
 * never depends on an external export — matching its body-parsing duck-typing.
 */
const getStatus = (error: unknown): number | undefined => {
    const status = getResponse(error)?.status
    return typeof status === 'number' ? status : undefined
}

/**
 * Best-effort JSON parse of the error body. Clones first (so the original stream
 * is never consumed) when the response supports it, and swallows any failure —
 * the body shape is undocumented, so callers should never depend on it.
 *
 * Prefers `text()` + `JSON.parse` (what the transport itself uses, and the most
 * robust across runtimes); falls back to `json()` for sources that only expose
 * it (e.g. test mocks).
 */
const readJsonBody = async (response: JsonReadable): Promise<unknown> => {
    try {
        const source =
            typeof response.clone === 'function' ? response.clone() : response
        if (typeof source.text === 'function') {
            const text = await source.text()
            return text ? JSON.parse(text) : undefined
        }
        if (typeof source.json === 'function') return await source.json()
        return undefined
    } catch {
        return undefined
    }
}

const firstString = (
    body: Record<string, unknown>,
    keys: string[],
): string | undefined => {
    for (const key of keys) {
        const value = body[key]
        if (typeof value === 'string' && value.length > 0) return value
    }
    return undefined
}

type NestedError = { status?: number; code?: string; message?: string }

/**
 * Baanx nests its real error as a JSON *string* inside `message`, e.g.
 * `{"message":"{\"error\":{\"status\":500,\"message\":\"…\",\"errorCode\":null}}"}`
 * or `{"message":"{\"error\":\"Duplicate onboardingId\",\"details\":[\"…\"]}"}`.
 * Best-effort parse it and pull out the inner status/code/message; returns
 * undefined when `value` isn't a JSON-object string (the common case) or parsing
 * fails, so the caller keeps the original message untouched.
 */
const unwrapNestedError = (
    value: string | undefined,
): NestedError | undefined => {
    if (!value || !value.trimStart().startsWith('{')) return undefined
    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        return undefined
    }
    if (typeof parsed !== 'object' || parsed === null) return undefined

    const inner = (parsed as { error?: unknown }).error
    const details = (parsed as { details?: unknown }).details
    const firstDetail =
        Array.isArray(details) && typeof details[0] === 'string'
            ? details[0]
            : undefined

    // `error` as an object: { status, message, errorCode }.
    if (typeof inner === 'object' && inner !== null) {
        const record = inner as Record<string, unknown>
        return {
            status:
                typeof record.status === 'number' ? record.status : undefined,
            code:
                typeof record.errorCode === 'string'
                    ? record.errorCode
                    : undefined,
            message:
                typeof record.message === 'string'
                    ? record.message
                    : firstDetail,
        }
    }
    // `error` as a string: "Duplicate onboardingId" (+ `details`).
    if (typeof inner === 'string') {
        return { code: inner, message: firstDetail ?? inner }
    }
    return firstDetail ? { message: firstDetail } : undefined
}

/**
 * Resolves the error body. ky pre-parses and *consumes* the response body into
 * `error.data` (so `error.response.json()`/`text()` no longer work) — that's the
 * canonical source. Falls back to reading the response body directly for non-ky
 * errors / test mocks that expose it there.
 */
const resolveErrorBody = async (error: unknown): Promise<unknown> => {
    if (typeof error === 'object' && error !== null) {
        const data = (error as { data?: unknown }).data
        if (data !== undefined && data !== null) return data
    }
    const response = getResponse(error)
    return response ? await readJsonBody(response) : undefined
}

/**
 * Normalizes an unknown thrown value into a {@link CardApiError}. The HTTP
 * status is always extracted when present; the response body is parsed
 * best-effort for a `code`/`message` (Baanx's exact shape is undocumented).
 * Always resolves — never throws — so callers can branch in a `catch`.
 */
export const getCardApiError = async (
    error: unknown,
): Promise<CardApiError> => {
    const status = getStatus(error)
    const body = await resolveErrorBody(error)

    // A plain-text error body is itself the message.
    if (typeof body === 'string') {
        return { status, message: body.length > 0 ? body : undefined }
    }
    if (typeof body !== 'object' || body === null) return { status }

    const record = body as Record<string, unknown>
    const code = firstString(record, ['code', 'errorCode', 'error'])
    const message = firstString(record, [
        'message',
        'detail',
        'error_description',
    ])

    // Baanx wraps the real error as a JSON string inside `message` — unwrap it so
    // callers see the actual status/code/message instead of an opaque blob.
    const nested = unwrapNestedError(message)
    if (nested) {
        return {
            status: status ?? nested.status,
            code: nested.code ?? code,
            message: nested.message ?? message,
        }
    }

    return { status, code, message }
}

/** HTTP statuses that mean "this value conflicts with an existing record". */
const CONFLICT_STATUSES = new Set([409, 422])

/** True when the failure looks like a duplicate/conflict (e.g. value taken). */
export const isConflictError = (apiError: CardApiError): boolean =>
    apiError.status !== undefined && CONFLICT_STATUSES.has(apiError.status)

/** True when the failure looks like a rejected/invalid submission (400/422). */
export const isInvalidInputError = (apiError: CardApiError): boolean =>
    apiError.status === 400 || apiError.status === 422

/**
 * True when the failure means the record already exists (e.g. Baanx's
 * "Duplicate onboardingId … already exists"). Matched by message text rather
 * than HTTP status — Baanx's status for this case is unconfirmed — so a retry
 * of a non-idempotent submit can be treated as success.
 */
export const isDuplicateError = (apiError: CardApiError): boolean =>
    /duplicate|already exists/i.test(
        `${apiError.code ?? ''} ${apiError.message ?? ''}`,
    )

/**
 * True when Baanx refused because the user's KYC isn't VERIFIED yet. The
 * guides document `code: USER_NOT_VERIFIED` with status 400 or 403; the live
 * sandbox has been seen returning only `message: "Account has not been
 * verified"`. So, like {@link isDuplicateError}, match on text rather than
 * HTTP status.
 */
export const isNotVerifiedError = (apiError: CardApiError): boolean =>
    /USER_NOT_VERIFIED|not (been )?verified/i.test(
        `${apiError.code ?? ''} ${apiError.message ?? ''}`,
    )
