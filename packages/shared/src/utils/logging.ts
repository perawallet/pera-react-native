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
import type { Nullable, Optional } from './types'

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

// Whole-key (exact) matches only, for keys carrying raw transaction or signing
// payloads. Exact rather than substring is deliberate: a substring would also
// wipe the diagnostic siblings engineers rely on (`txnGroup`, `txns`,
// `txnBytes`). `walletTxn` is deliberately absent — it's a wrapper whose inner
// `txn` the recursive walk already redacts, preserving its signer siblings.
// Entries must be lowercase.
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

// Some payloads reach the logger as raw JSON, which the URL-style query regex
// above wouldn't touch. Fragment keys match as a substring of the JSON key;
// exact keys match the whole key only, so `"txnGroup"`/`"txns"` survive.
const SENSITIVE_JSON_REGEX = new RegExp(
    `("(?:[^"]*(?:${SENSITIVE_KEY_FRAGMENTS.join(
        '|',
    )})[^"]*|${SENSITIVE_EXACT_KEYS.join('|')})"\\s*:\\s*)"[^"]*"`,
    'gi',
)

/** Idempotent on plain strings with no query or JSON syntax. */
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
 * Every string value also goes through `redactSensitiveUrl`, so a stray URL
 * under a non-sensitive key still gets its query params scrubbed. A top-level
 * `Error` (the `context.error` convention) passes through verbatim — see
 * `redactSensitiveContext`, which special-cases it before ever calling this —
 * because `formatContextValue` picks its name/message/stack/code/cause right
 * after. An `Error` found *while walking* a nested object or array gets no
 * such follow-up, so it is walked here like any other object. Typed arrays
 * become a `[Ctor(length)]` placeholder rather than being enumerated byte by
 * byte, and cycles or depth past MAX_REDACT_DEPTH short-circuit.
 *
 * Applied automatically to every logger context, so callers needn't pre-sanitize
 * — though a hot path with very large objects may still want to.
 */
const redactSensitiveValue = (
    value: unknown,
    depth: number,
    seen: WeakSet<object>,
): unknown => {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') return redactSensitiveUrl(value)
    if (typeof value !== 'object') return value
    // A typed array (Uint8Array, Buffer, ...) has one own enumerable key per
    // byte, so the generic object walk below would happily redact-and-emit
    // every byte of a key. Byte length is diagnostic; the bytes are secret.
    // `ArrayBuffer.isView`, not `instanceof Uint8Array`: a typed array from
    // another realm (e.g. jsdom in tests) fails `instanceof` the local
    // constructor and would silently fall through to the byte-enumerating path.
    if (ArrayBuffer.isView(value)) {
        const ctorName = value.constructor?.name ?? 'TypedArray'
        const size =
            'length' in value
                ? (value as unknown as { length: number }).length
                : (value as DataView).byteLength
        return `[${ctorName}(${size})]`
    }
    if (depth >= MAX_REDACT_DEPTH) return TRUNCATED
    if (seen.has(value)) return TRUNCATED
    seen.add(value)
    if (Array.isArray(value)) {
        return value.map(item => redactSensitiveValue(item, depth + 1, seen))
    }
    if (value instanceof Error) {
        // message/stack are non-enumerable, so Object.entries below never
        // touches them — only extra own properties (anything a caller attached
        // via Object.assign, e.g. a leaked secret) need the same redaction as
        // any other object's keys.
        const out: Record<string, unknown> = {
            name: value.name,
            message: value.message,
        }
        for (const [k, v] of Object.entries(value)) {
            out[k] = isSensitiveKey(k)
                ? REDACTED
                : redactSensitiveValue(v, depth + 1, seen)
        }
        return out
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
        // A top-level Error is exempted here, not inside redactSensitiveValue:
        // formatContextValue is about to pick its name/message/stack/code/cause
        // explicitly, so it must stay `instanceof Error` and untouched. An Error
        // found while walking a nested value has no such follow-up and is
        // redacted for real inside redactSensitiveValue.
        out[k] = isSensitiveKey(k)
            ? REDACTED
            : v instanceof Error
              ? v
              : redactSensitiveValue(v, 0, seen)
    }
    return out
}

export type LogErrorSeverity = 'error' | 'critical'

export type ErrorReportPayload = {
    severity: LogErrorSeverity
    error: unknown
    /**
     * Stable name for the logical error site, set only when `error`'s stack was
     * captured inside the logger and so cannot identify the caller. Reporters
     * that fingerprint on the stack need it to tell two sites apart; see
     * `reportError`.
     */
    groupingKey?: string
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

    // Wrapped re-throws are normal in this codebase (useAlgo25.ts, useHDWallet.ts,
    // useCreateAccount.ts), so the cause chain can be several Errors deep. The cap
    // bounds recursion regardless of shape, including a mutual cycle (x.cause = y,
    // y.cause = x) that a same-node self-reference check wouldn't catch; the
    // separate `cause !== value` check only stops a self-referential Error from
    // emitting a redundant copy of itself as its own cause.
    private static readonly MAX_CAUSE_DEPTH = 3

    private formatContextValue(value: unknown, depth = 0): unknown {
        if (value instanceof Error) {
            // React-native-keychain rejections put the only discriminating
            // value on `code` (E_CRYPTO_FAILED vs E_KEYSTORE_ACCESS_ERROR),
            // and the keystore package wraps engine failures in `cause` —
            // without both, every Android keystore failure looks identical.
            const code = (value as { code?: unknown }).code
            const nativeStack = (value as { nativeStackAndroid?: unknown })
                .nativeStackAndroid

            return {
                name: value.name,
                message: value.message,
                // Crashlytics truncates the report; a nested stack crowds out the
                // sibling keys (code, cause) that actually diagnose this class of
                // bug, and is more device data leaving for no diagnostic gain.
                ...(value.stack && depth === 0 ? { stack: value.stack } : {}),
                ...(typeof code === 'string' || typeof code === 'number'
                    ? { code }
                    : {}),
                // RN's own PromiseImpl/JavaTurboModule copy this onto the JS
                // Error as an array of frame maps (class/file/line/method), never
                // a string — a `typeof === 'string'` gate here is always false and
                // silently drops the one Android diagnostic this ticket needs.
                // Treat it like `cause`: redacted and depth-capped, not dropped.
                ...(nativeStack !== undefined
                    ? {
                          nativeStackAndroid: redactSensitiveValue(
                              nativeStack,
                              0,
                              new WeakSet(),
                          ),
                      }
                    : {}),
                ...(value.cause !== undefined &&
                value.cause !== value &&
                depth < Logger.MAX_CAUSE_DEPTH
                    ? {
                          // A non-Error cause (plain object, array, Uint8Array...)
                          // never reaches the `instanceof Error` branch above, so it
                          // must be routed back through the same redactor every other
                          // context value goes through — otherwise a sensitive key
                          // nested under `cause` ships unredacted while the identical
                          // key at the top level of context gets scrubbed.
                          cause:
                              value.cause instanceof Error
                                  ? this.formatContextValue(
                                        value.cause,
                                        depth + 1,
                                    )
                                  : redactSensitiveValue(
                                        value.cause,
                                        0,
                                        new WeakSet(),
                                    ),
                      }
                    : {}),
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

                // No groupingKey: this error's own stack points at where it was
                // thrown, which separates sites far better than a shared name
                // would. Supplying one here would prepend an identical frame
                // above genuinely distinct stacks and merge them.
                this.errorReporter({ severity, error: reportableError })
                return
            }

            // A string message means `reportableError`'s stack was captured
            // here, inside the logger — so it is identical for every such call
            // in the app, and a stack-fingerprinting reporter collapses them all
            // into one issue. Two things fix that:
            //
            // 1. `groupingKey`, the constant message, names the site. The
            //    message alone, never `combinedMessage`, whose interpolated
            //    context would make every event its own issue.
            // 2. Adopting the stack of an `Error` passed in context, so the
            //    frames below point at the real origin instead of at `log()`.
            const contextError = this.findContextError(context)
            if (contextError?.stack) {
                reportableError.stack = contextError.stack
            }

            this.errorReporter({
                severity,
                error: reportableError,
                groupingKey: message,
            })
        } catch {
            // Never allow error reporting to crash the app.
        }
    }

    /**
     * The `{ error }` convention most call sites already follow. `cause` and
     * `reason` cover the promise-rejection and settled-result spellings.
     * Deliberately shallow: a nested search would start adopting stacks from
     * incidental errors buried in a payload.
     */
    private findContextError(context?: LogContext): Optional<Error> {
        if (!context) return undefined
        for (const key of ['error', 'cause', 'reason']) {
            const value = (context as Record<string, unknown>)[key]
            if (value instanceof Error) return value
        }
        return undefined
    }

    /**
     * RN's LogBox intercepts `console.error` in dev, and with multiple
     * `ReactNativeHost`s registered it occasionally throws from inside
     * `LogBoxData.addLog` — masking the very error being logged. Wrapping keeps
     * `reportError` firing and falls back to `console.log`.
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

        // A throwing getter (e.g. a native module's `code` accessor) must not
        // escape into the caller's error handler — this file's whole premise is
        // that logging never crashes the app.
        let args: LogContext[] = []
        if (context) {
            try {
                args = [this.formatContext(context)]
            } catch {
                args = [{ context: '[unformattable context]' }]
            }
        }

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
