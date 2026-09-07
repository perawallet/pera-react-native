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
import { isExpectedError } from '../errors/expected'
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

// `message` and `stack` are typed as strings but a native module can set either
// to anything; redactSensitiveUrl would throw on a non-string and cost the whole
// report.
const redactMaybeString = <T>(value: T): T =>
    typeof value === 'string' ? (redactSensitiveUrl(value) as T) : value

// ...and it can make either a throwing accessor, which `log()` already guards
// context against. A field the logger cannot read is one the reporter cannot
// read either, so drop the field rather than the report. `ok` keeps a failed
// read distinguishable from a genuine `undefined` — conflating them would let a
// hostile accessor reach the reporter untouched.
type SafeRead = { ok: boolean; value: unknown }

const readSafely = (read: () => unknown): SafeRead => {
    try {
        return { ok: true, value: read() }
    } catch {
        return { ok: false, value: undefined }
    }
}

// A native stack is bulk: uncapped, it pushes the `code`/`cause` keys that
// diagnose a keystore failure out of Crashlytics' truncation window. The top of
// the stack is the diagnostic part, in either shape RN might hand us.
const MAX_NATIVE_STACK_FRAMES = 10
const MAX_NATIVE_STACK_CHARS = 2000

const capNativeStack = (nativeStack: unknown): unknown => {
    if (Array.isArray(nativeStack))
        return nativeStack.slice(0, MAX_NATIVE_STACK_FRAMES)
    if (typeof nativeStack === 'string')
        return nativeStack.slice(0, MAX_NATIVE_STACK_CHARS)
    return nativeStack
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
            message: redactMaybeString(value.message),
        }
        for (const [k, v] of Object.entries(value)) {
            out[k] = isSensitiveKey(k)
                ? REDACTED
                : redactSensitiveValue(
                      // Capped but not depth-gated like formatContextValue's
                      // copy: this branch is only reachable at depth >= 1, so a
                      // gate here would drop every native stack it ever sees.
                      k === 'nativeStackAndroid' ? capNativeStack(v) : v,
                      depth + 1,
                      seen,
                  )
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

// Crashlytics sends `message` and `stack` to native verbatim, so an Error
// reported as-is is a second, unredacted copy of anything the serialized
// context already scrubbed. Returning the original when nothing matched is only
// an optimisation: the clone keeps the prototype and non-sensitive own
// properties, so a
// reporter that branches on `instanceof` or reads `.code` cannot tell a redacted
// error from an untouched one.
const redactErrorForReport = (error: Error): Error => {
    const rawMessage = readSafely(() => error.message)
    const rawStack = readSafely(() => error.stack)
    const message = redactMaybeString(rawMessage.value)
    const stack = redactMaybeString(rawStack.value)
    // A read that threw must not take the fast path: returning the original
    // would hand the reporter a live hostile accessor, and a reporter that
    // reads `.stack` then throws and loses the report. The clone below
    // materialises plain values, so it neutralises the accessor.
    if (
        rawMessage.ok &&
        rawStack.ok &&
        message === rawMessage.value &&
        stack === rawStack.value
    )
        return error

    const name = readSafely(() => error.name).value

    try {
        const redacted = Object.create(Object.getPrototypeOf(error)) as Error
        const target = redacted as unknown as Record<string, unknown>
        const source = error as unknown as Record<string, unknown>
        // One key at a time, not Object.assign: a single throwing native
        // accessor would abort the whole copy and cost the entire report.
        // Sensitive keys are skipped outright — a redactor must never hand a
        // raw mnemonic to the reporting boundary.
        for (const key of Object.keys(error)) {
            if (isSensitiveKey(key)) continue
            try {
                target[key] = source[key]
            } catch {
                // drop the unreadable property, not the report
            }
        }
        // Non-enumerable, like a real Error's own fields: an enumerable copy
        // would put message/stack into JSON.stringify of the reported error.
        for (const [key, value] of [
            ['name', name],
            ['message', message],
            ['stack', stack],
        ] as const) {
            Object.defineProperty(redacted, key, {
                value,
                enumerable: false,
                writable: true,
                configurable: true,
            })
        }
        return redacted
    } catch {
        const fallback = new Error(String(message))
        fallback.name = String(name)
        fallback.stack = stack as typeof fallback.stack
        return fallback
    }
}

// Structurally mirrored by `LogSeverity` in
// `extensions/platform/src/reporting/utils.ts`, which routes 'expected' to a
// breadcrumb. The two unions are unrelated at compile time because the platform
// extension deliberately does not depend on this package, so the literals have
// to be kept in step by hand.
export type LogErrorSeverity = 'error' | 'critical' | 'expected'

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

    public error(
        error: Error | string,
        context?: LogContext,
        options?: { force?: boolean },
    ) {
        // A site that already knows better can opt out; everything else is
        // classified centrally so the policy stays in one reviewable place.
        //
        // The context is classified too because most call sites pass a constant
        // string plus `{ error }` (the query cache's 'An error has occurred:'
        // being the one every algod and indexer failure reaches). Judging only
        // the first argument would leave the policy inert at the majority of
        // sites, including every transport timeout and 5xx.
        if (
            !options?.force &&
            (isExpectedError(error) ||
                isExpectedError(this.findContextError(context)))
        ) {
            this.log(LogLevel.WARN, error, context, 'expected')
            return
        }
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

            // Key order is load-bearing: JSON.stringify emits insertion
            // order and Crashlytics truncates the report, so the diagnostic
            // keys precede the two bulky stacks.
            return {
                name: value.name,
                message: redactMaybeString(value.message),
                ...(typeof code === 'string' || typeof code === 'number'
                    ? { code }
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
                // A stack's first line is the message, so it needs the same
                // scrubbing. Both stacks are gated to depth 0: a nested one
                // crowds out the sibling code/cause keys that diagnose this
                // class of bug, for no diagnostic gain of its own.
                ...(typeof value.stack === 'string' && depth === 0
                    ? { stack: redactSensitiveUrl(value.stack) }
                    : {}),
                // RN's PromiseImpl/JavaTurboModule copies this onto the JS Error
                // as an array of frame maps (class/file/line/method), never a
                // string.
                ...(nativeStack !== undefined && depth === 0
                    ? {
                          nativeStackAndroid: redactSensitiveValue(
                              capNativeStack(nativeStack),
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
                    error: redactErrorForReport(messageOrError),
                })
                return
            }

            // String(): `message` is typed as a string but a native module can
            // set it to anything, and the report's message must stay one —
            // `new Error(<non-string>)` stringified it the same way.
            const message =
                messageOrError instanceof Error
                    ? String(
                          redactMaybeString(
                              readSafely(() => messageOrError.message).value,
                          ),
                      )
                    : redactSensitiveUrl(messageOrError)
            const contextText = this.stringifyContext(context)
            const combinedMessage = contextText
                ? `${message} | context: ${contextText}`
                : message

            const reportableError = new Error(combinedMessage)

            if (messageOrError instanceof Error) {
                reportableError.name = messageOrError.name
                reportableError.stack = redactMaybeString(
                    readSafely(() => messageOrError.stack).value,
                ) as typeof reportableError.stack

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
            // Read through readSafely: a throwing `stack` accessor here would
            // land in the outer catch and drop the whole report.
            const adoptedStack = readSafely(() => contextError?.stack).value
            if (adoptedStack) {
                reportableError.stack = redactMaybeString(
                    adoptedStack,
                ) as typeof reportableError.stack
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
        reportAs?: LogErrorSeverity,
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
                // Only a downgraded error reports; a plain `warn` stays
                // console-only, so the breadcrumb trail reads as "errors we
                // chose not to report" rather than every warning in the app.
                if (reportAs) {
                    this.reportError(reportAs, messageOrError, context)
                }
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
