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

import {
    bytesToHex,
    decodeFromBase64,
    decodePrintableUtf8,
} from '@perawallet/wallet-core-shared'
import type { ArbitraryDataDisplay } from '@perawallet/wallet-core-signing'

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

    const text = decodePrintableUtf8(bytes)
    return text === undefined
        ? { kind: 'hex', hex: bytesToHex(bytes) }
        : { kind: 'text', text }
}
