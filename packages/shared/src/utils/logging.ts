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

import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from './types'

/**
 * Log levels for controlling log output and error reporting
 * Ordered by severity: DEBUG < INFO < WARN < ERROR < CRITICAL
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

const LOG_LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.CRITICAL]: 'CRITICAL',
}

/**
 * Interface for structured log context
 */
export interface LogContext {
    [key: string]: unknown
}

const SENSITIVE_KEY_FRAGMENTS = [
    'mnemonic',
    'passphrase',
    'seed',
    'privatekey',
    'private_key',
    'encryptionkey',
    'encryption_key',
    'secret',
    'password',
    'pin',
    'signature',
] as const

// Keys redacted only on a whole-key (exact) match. These carry raw transaction
// or signing payloads — the base64 blob in WalletConnect `algo_signTxn`
// (`txn`), the ARC-0001 signed-txn field (`stxn`), signed/raw/unsigned
// transaction bytes, and the `algo_signData` auth challenge
// (`authenticatorData`) — and must be scrubbed. Exact (not substring) match is
// deliberate: a substring would also wipe the diagnostic siblings engineers
// rely on (`txnGroup`, `txns`, `txnBytes`). `walletTxn` is intentionally NOT
// listed — it's a wrapper object whose inner `txn` is already redacted by the
// recursive walk, which preserves its signer siblings. Entries must be
// lowercase (compared against `lower`).
const SENSITIVE_EXACT_KEYS = [
    'txn',
    'stxn',
    'stxns',
    'signedtxn',
    'signedtxns',
    'rawtxn',
    'rawtxns',
    'unsignedtxn',
    'authenticatordata',
    // WC v1 pairing URIs carry the symmetric handshake key as `key=`;
    // exact so `keyregType`/`keyPairId` style params survive.
    'key',
] as const

const REDACTED = '[REDACTED]'

const isSensitiveKey = (key: string): boolean => {
    const lower = key.toLowerCase()
    return (
        SENSITIVE_KEY_FRAGMENTS.some(fragment => lower.includes(fragment)) ||
        SENSITIVE_EXACT_KEYS.some(exact => lower === exact)
    )
}

// Exact keys participate here too: each key is already anchored between a
// `^`/`?&#` boundary and `=`, so this is a whole-parameter match that never
// over-matches `txnGroup`/`txns`.
const SENSITIVE_QUERY_REGEX = new RegExp(
    `((?:^|[?&#])(?:${[
        ...SENSITIVE_KEY_FRAGMENTS,
        ...SENSITIVE_EXACT_KEYS,
    ].join('|')})=)([^&#]*)`,
    'gi',
)

// Some payloads (Pera Web QR deeplinks, structured logs that have been
// pre-stringified by the caller) reach the logger as raw JSON. The query
// regex above only matches URL-style `?key=value` syntax, so a JSON-shaped
// string containing a sensitive field would pass through untouched. Match
// any `"…sensitive…":"value"` pair so the value is scrubbed regardless of
// the surrounding format.
// Fragment keys match as a substring of the JSON key; exact keys (`txn`) match
// the whole key only, so `"txnGroup"`/`"txns"` values are preserved.
const SENSITIVE_JSON_REGEX = new RegExp(
    `("(?:[^"]*(?:${SENSITIVE_KEY_FRAGMENTS.join(
        '|',
    )})[^"]*|${SENSITIVE_EXACT_KEYS.join('|')})"\\s*:\\s*)"[^"]*"`,
    'gi',
)

/**
 * Strip values for any query/hash parameter or JSON field whose name
 * matches a known sensitive fragment (mnemonic, passphrase, seed,
 * encryptionKey, …). Idempotent on plain strings without query/JSON
 * syntax.
 */
export const redactSensitiveUrl = (input: string): string => {
    let out = input
    if (out.includes('=')) {
        out = out.replace(SENSITIVE_QUERY_REGEX, `$1${REDACTED}`)
    }
    if (out.includes('"')) {
        out = out.replace(SENSITIVE_JSON_REGEX, `$1"${REDACTED}"`)
    }
    return out
}

// Defense against pathological inputs (circular references, deeply-nested
// objects). Logger contexts are normally small; anything beyond this depth is
// almost certainly a mistake (e.g. a React fiber leaked into context).
const MAX_REDACT_DEPTH = 8
const TRUNCATED = '[…]'

/**
 * Recursively redact sensitive entries from a structured value:
 *  - any object property whose key contains a sensitive fragment is replaced
 *    with `[REDACTED]`
 *  - any string value is passed through `redactSensitiveUrl` so a stray URL
 *    in a non-sensitive key (e.g. `{ url }`) still gets its mnemonic/passphrase
 *    query params scrubbed
 *  - arrays and nested objects are walked; non-string primitives pass through
 *  - `Error` instances are passed through verbatim — `formatContextValue`
 *    handles their structured shape downstream
 *  - circular references and depth > MAX_REDACT_DEPTH are short-circuited to
 *    avoid stack overflow / DoS
 *
 * Used automatically by the logger on every context, so callers don't need to
 * remember to pre-sanitize. Cheap on small contexts; for a hot path with very
 * large objects, callers may still want to redact upstream.
 */
const redactSensitiveValue = (
    value: unknown,
    depth: number,
    seen: WeakSet<object>,
): unknown => {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') return redactSensitiveUrl(value)
    if (typeof value !== 'object') return value
    if (value instanceof Error) return value
    if (depth >= MAX_REDACT_DEPTH) return TRUNCATED
    if (seen.has(value)) return TRUNCATED
    seen.add(value)
    if (Array.isArray(value)) {
        return value.map(item => redactSensitiveValue(item, depth + 1, seen))
    }
    // ARC-0001 `algo_signData` / ARC-60 payloads carry the signed message in a
    // `data` field next to `authenticatorData`. `data` is far too common a key
    // to redact globally, so scrub it only inside an object that also carries
    // `authenticatorData` — the marker of a signing payload.
    const lowerKeys = new Set(Object.keys(value).map(key => key.toLowerCase()))
    const isSignDataPayload =
        lowerKeys.has('authenticatordata') && lowerKeys.has('data')
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
        const isScopedSignData = isSignDataPayload && k.toLowerCase() === 'data'
        out[k] =
            isSensitiveKey(k) || isScopedSignData
                ? REDACTED
                : redactSensitiveValue(v, depth + 1, seen)
    }
    return out
}

export const redactSensitiveContext = (context: LogContext): LogContext => {
    const seen = new WeakSet<object>()
    const out: LogContext = {}
    for (const [k, v] of Object.entries(context)) {
        out[k] = isSensitiveKey(k) ? REDACTED : redactSensitiveValue(v, 0, seen)
    }
    return out
}

export type LogErrorSeverity = 'error' | 'critical'

export type ErrorReportPayload = {
    severity: LogErrorSeverity
    error: unknown
}

export type ErrorReporter = (payload: ErrorReportPayload) => void

class Logger {
    private level: LogLevel = LogLevel.INFO // Default safe level
    private errorReporter: Nullable<ErrorReporter> = null

    constructor() {
        // Initialize level based on config
        // In a real app we might load this from a remote config or local storage
        if (config.debugEnabled) {
            this.level = LogLevel.DEBUG
        }
    }

    /**
     * Set the minimum log level for output
     */
    public setLevel(level: LogLevel) {
        this.level = level
    }

    public setErrorReporter(reporter?: Nullable<ErrorReporter>) {
        this.errorReporter = reporter ?? null
    }

    public debug(message: string, context?: LogContext) {
        this.log(LogLevel.DEBUG, message, context)
    }

    public info(message: string, context?: LogContext) {
        this.log(LogLevel.INFO, message, context)
    }

    public warn(message: string, context?: LogContext) {
        this.log(LogLevel.WARN, message, context)
    }

    public error(error: Error | string, context?: LogContext) {
        this.log(LogLevel.ERROR, error, context)
    }

    public critical(error: Error | string, context?: LogContext) {
        this.log(LogLevel.CRITICAL, error, context)
    }

    private formatContextValue(value: unknown): unknown {
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                ...(value.stack ? { stack: value.stack } : {}),
            }
        }
        return value
    }

    private formatContext(context: LogContext): LogContext {
        const redacted = redactSensitiveContext(context)
        const formatted: LogContext = {}
        for (const [key, value] of Object.entries(redacted)) {
            formatted[key] = this.formatContextValue(value)
        }
        return formatted
    }

    private stringifyContext(context?: LogContext): string {
        if (!context) {
            return ''
        }

        try {
            return JSON.stringify(this.formatContext(context))
        } catch {
            return '[unserializable context]'
        }
    }

    private reportError(
        severity: LogErrorSeverity,
        messageOrError: string | Error,
        context?: LogContext,
    ) {
        if (!this.errorReporter) {
            return
        }

        try {
            if (messageOrError instanceof Error && !context) {
                this.errorReporter({
                    severity,
                    error: messageOrError,
                })
                return
            }

            const message =
                messageOrError instanceof Error
                    ? messageOrError.message
                    : messageOrError
            const contextText = this.stringifyContext(context)
            const combinedMessage = contextText
                ? `${message} | context: ${contextText}`
                : message

            const reportableError = new Error(combinedMessage)

            if (messageOrError instanceof Error) {
                reportableError.name = messageOrError.name
                reportableError.stack = messageOrError.stack
            }

            this.errorReporter({
                severity,
                error: reportableError,
            })
        } catch {
            // Never allow error reporting to crash the app.
        }
    }

    /**
     * `console.error` is intercepted by RN's LogBox in dev mode. With multiple
     * `ReactNativeHost`s registered (Expo dev client + the app host) LogBox
     * occasionally crashes with "Cannot read property 'log' of undefined"
     * inside `LogBoxData.addLog`. The crash bubbles out of `console.error` and
     * masks the actual error we're trying to log. Wrap the call so the
     * downstream `reportError` (Sentry / etc.) still fires, and fall back to
     * `console.log` so the message is at least visible in the dev console.
     */
    private safeConsoleError(message: string, args: unknown[]) {
        try {
            console.error(message, ...args)
        } catch {
            try {
                console.log(`[ERROR] ${message}`, ...args)
            } catch {
                // give up — never let logging crash the app.
            }
        }
    }

    private log(
        level: LogLevel,
        messageOrError: string | Error,
        context?: LogContext,
    ) {
        // Filter out logs below current level
        if (level < this.level) {
            return
        }

        const prefix = `[${LOG_LEVEL_NAMES[level]}]`
        const message =
            messageOrError instanceof Error
                ? messageOrError.message
                : messageOrError

        const args = context ? [this.formatContext(context)] : []

        switch (level) {
            case LogLevel.DEBUG:
            case LogLevel.INFO: {
                console.log(`${prefix} ${message}`, ...args)
                break
            }
            case LogLevel.WARN: {
                console.warn(`${prefix} ${message}`, ...args)
                break
            }
            case LogLevel.ERROR: {
                this.safeConsoleError(`${prefix} ${message}`, args)
                this.reportError('error', messageOrError, context)
                break
            }
            case LogLevel.CRITICAL: {
                this.safeConsoleError(`${prefix} ${message}`, args)
                this.reportError('critical', messageOrError, context)
                break
            }
        }
    }
}

export const logger = new Logger()
