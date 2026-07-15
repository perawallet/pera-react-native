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

import { decodeFromBase64 } from './strings'

/**
 * Thrown when an untrusted input exceeds a configured size bound, before the
 * input is decoded, decrypted, text-decoded, or JSON-parsed. Defence-in-depth:
 * callers cap external/imported payloads so a malicious or corrupt blob can't
 * force an oversized allocation or parse. Each call site maps this to its own
 * typed/domain error (`Arc0001Error`, `AsbImportError`, …).
 */
export class InputTooLargeError extends Error {
    /** Caller-supplied label identifying the bounded field, surfaced for logs. */
    readonly label: string
    /** The configured maximum (chars for strings, bytes for decoded buffers). */
    readonly limit: number
    /** The observed size that tripped the bound. */
    readonly actual: number

    constructor(label: string, limit: number, actual: number) {
        super(`${label} exceeds maximum size (${actual} > ${limit})`)
        this.name = 'InputTooLargeError'
        this.label = label
        this.limit = limit
        this.actual = actual
    }
}

/**
 * Reject a string whose length exceeds `maxChars` before any further work.
 * Throws {@link InputTooLargeError}; otherwise returns void.
 */
export const assertMaxLength = (
    value: string,
    maxChars: number,
    label: string,
): void => {
    if (value.length > maxChars) {
        throw new InputTooLargeError(label, maxChars, value.length)
    }
}

/**
 * Base64-decode `base64` while enforcing a `maxBytes` cap on the *decoded*
 * size. Base64 packs 3 bytes per 4 chars, so a clearly-oversized input is
 * rejected from its encoded length alone — before `decodeFromBase64` allocates
 * a buffer. Padding shaves up to 2 bytes off the decoded size, so the encoded
 * length is only an upper bound; we pre-reject only when even the smallest
 * possible decoded size would overflow, and let the authoritative post-decode
 * check handle the boundary.
 *
 * Throws {@link InputTooLargeError} when the bound is exceeded.
 */
export const decodeBoundedBase64 = (
    base64: string,
    maxBytes: number,
    label = 'base64 input',
): Uint8Array => {
    const approxBytes = Math.floor((base64.length * 3) / 4)
    if (approxBytes - 2 > maxBytes) {
        throw new InputTooLargeError(label, maxBytes, approxBytes)
    }
    const bytes = decodeFromBase64(base64)
    if (bytes.length > maxBytes) {
        throw new InputTooLargeError(label, maxBytes, bytes.length)
    }
    return bytes
}
