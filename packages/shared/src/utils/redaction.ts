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

import { serializeError } from './serialize-error'

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
    'token',
    'authorization',
    'bearer',
    // PKCE code_verifier and friends.
    'verifier',
    'cvv',
    'cvc',
    'entropy',
    // Cloud backup's user-facing "Encryption Key" travels under this name.
    'salt',
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
    // Exact, not fragments: `pan` as a substring would wipe `panLast4`,
    // `isExpanded` and `participants`, and any `*shotP*` word contains `otp`.
    'pan',
    'otp',
    'otpcode',
    'otp_code',
] as const

export const REDACTED = '[REDACTED]'

export const isSensitiveKey = (key: string): boolean => {
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
export const redactMaybeString = <T>(value: T): T =>
    typeof value === 'string' ? (redactSensitiveUrl(value) as T) : value

// Defense against pathological inputs (circular references, deeply-nested
// objects). Logger contexts are normally small; anything beyond this depth is
// almost certainly a mistake (e.g. a React fiber leaked into context).
const MAX_REDACT_DEPTH = 8
const TRUNCATED = '[…]'

/**
 * Every string value also goes through `redactSensitiveUrl`, so a stray URL
 * under a non-sensitive key still gets its query params scrubbed. An `Error`
 * found while walking becomes its `ownProperties` serialization, each field
 * walked in turn; a top-level context Error never reaches here (see
 * `redactSensitiveContext`). Typed arrays become a `[Ctor(length)]`
 * placeholder rather than being enumerated byte by byte, and cycles or depth
 * past MAX_REDACT_DEPTH short-circuit.
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
        return serializeError(value, {
            fields: 'ownProperties',
            redactField: (key, field) =>
                isSensitiveKey(key)
                    ? REDACTED
                    : redactSensitiveValue(field, depth + 1, seen),
        })
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

/**
 * The `diagnostic` serialization of a top-level context Error. Each field
 * starts a fresh walk, so a deep cause or native stack gets the full depth
 * budget rather than inheriting the context's.
 */
export const redactContextError = (error: Error): Record<string, unknown> =>
    serializeError(error, {
        fields: 'diagnostic',
        redactField: (key, field) =>
            isSensitiveKey(key)
                ? REDACTED
                : redactSensitiveValue(field, 0, new WeakSet()),
    })

/**
 * Applied automatically to every logger context, so callers needn't
 * pre-sanitize, though a hot path with very large objects may still want to.
 */
export const redactSensitiveContext = (context: LogContext): LogContext => {
    const seen = new WeakSet<object>()
    const out: LogContext = {}
    for (const [k, v] of Object.entries(context)) {
        // A top-level Error stays `instanceof Error` and untouched: the logger
        // serializes it with `redactContextError`, whose allowlist keeps the
        // stack and code a nested Error's serialization drops.
        out[k] = isSensitiveKey(k)
            ? REDACTED
            : v instanceof Error
              ? v
              : redactSensitiveValue(v, 0, seen)
    }
    return out
}
