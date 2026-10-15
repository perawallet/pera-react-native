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

// JSON round-tripping a byte field produces one of two shapes depending on the
// source: a plain Uint8Array loses its identity to an index-keyed object, while
// Buffer.prototype.toJSON intercepts first and yields { type: 'Buffer', data }.
export const toBytes = (value: unknown): Uint8Array | undefined => {
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value)
    }

    if (ArrayBuffer.isView(value)) {
        // ArrayBuffer.isView checks an internal slot rather than the
        // prototype chain, so it still recognizes typed arrays (e.g. Buffer)
        // constructed in a different realm than this module's Uint8Array.
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    }

    if (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'Buffer' &&
        'data' in value &&
        Array.isArray(value.data)
    ) {
        return new Uint8Array(value.data)
    }

    return undefined
}

export const decodeBytesToText = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value ? value : undefined
    }

    const bytes = toBytes(value)
    if (!bytes) {
        return undefined
    }

    const text = new TextDecoder().decode(bytes)

    return text ? text : undefined
}

// Zero-width characters hide content; bidi controls (U+202E and friends) can
// visually reorder text so the user reads something different from the bytes
// they sign. None are control characters, so a regex class is safe here.
const INVISIBLE_OR_BIDI_CHARS =
    /[\u061C\u200B-\u200F\u2060\u202A-\u202E\u2066-\u2069\uFEFF]/

// Characters that let a payload masquerade as innocuous text: C0/C1 controls
// and DEL (valid UTF-8 no human can read), plus the invisible/bidi set above.
const hasUnprintableChars = (text: string): boolean => {
    if (INVISIBLE_OR_BIDI_CHARS.test(text)) {
        return true
    }
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0
        const isAllowedWhitespace =
            code === 0x09 || code === 0x0a || code === 0x0d
        if (
            (code < 0x20 && !isAllowedWhitespace) ||
            (code >= 0x7f && code <= 0x9f)
        ) {
            return true
        }
    }
    return false
}

/**
 * The text a human can safely review as what they sign, or `undefined` when
 * the bytes are empty, not strict UTF-8, or hide content. Lossy decoding would
 * collapse invalid sequences to U+FFFD, so the reviewer could approve bytes
 * they never read.
 */
export const decodePrintableUtf8 = (bytes: Uint8Array): string | undefined => {
    if (bytes.length === 0) {
        return undefined
    }
    let text: string
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        return undefined
    }
    return hasUnprintableChars(text) ? undefined : text
}
