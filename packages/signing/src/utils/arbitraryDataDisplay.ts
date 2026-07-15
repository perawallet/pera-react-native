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

import { bytesToHex, decodeFromBase64 } from '@perawallet/wallet-core-shared'

export type ArbitraryDataDisplay =
    | { kind: 'text'; text: string }
    | { kind: 'hex'; hex: string }

// Characters that let a payload masquerade as innocuous text: C0/C1 controls
// and DEL (valid UTF-8 no human can read), zero-width characters (hide
// content), and bidi controls (U+202E and friends can visually reorder text
// so the user reads something different from the bytes they sign).
const hasUnprintableChars = (text: string): boolean => {
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0
        const isAllowedWhitespace =
            code === 0x09 || code === 0x0a || code === 0x0d
        const isControl =
            (code < 0x20 && !isAllowedWhitespace) ||
            (code >= 0x7f && code <= 0x9f)
        const isZeroWidth =
            (code >= 0x200b && code <= 0x200d) ||
            code === 0x2060 ||
            code === 0xfeff
        const isBidiControl =
            code === 0x061c ||
            code === 0x200e ||
            code === 0x200f ||
            (code >= 0x202a && code <= 0x202e) ||
            (code >= 0x2066 && code <= 0x2069)
        if (isControl || isZeroWidth || isBidiControl) {
            return true
        }
    }
    return false
}

/**
 * Decodes an arbitrary-data sign payload (base64) for human review. Binary
 * payloads must never be shown as lossy UTF-8 — invalid sequences collapse to
 * U+FFFD (or nothing at all), so the user could approve signing bytes they
 * never actually read. Anything that isn't cleanly printable UTF-8 comes back
 * as a hex dump instead. Never throws.
 */
export const decodeArbitraryDataForDisplay = (
    data: string,
): ArbitraryDataDisplay => {
    let bytes: Uint8Array
    try {
        bytes = decodeFromBase64(data)
    } catch {
        // Malformed base64 upstream — show the raw bytes we were handed so
        // the review still reflects deterministic content.
        return { kind: 'hex', hex: bytesToHex(new TextEncoder().encode(data)) }
    }

    if (bytes.length === 0) {
        return { kind: 'hex', hex: '' }
    }

    let text: string
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        return { kind: 'hex', hex: bytesToHex(bytes) }
    }

    if (hasUnprintableChars(text)) {
        return { kind: 'hex', hex: bytesToHex(bytes) }
    }

    return { kind: 'text', text }
}
