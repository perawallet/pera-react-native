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

import { stripUrlScheme } from '@perawallet/wallet-core-shared'

// Embedding, override and isolate controls plus the implicit direction marks:
// a peer can use them to make its name or URL read backwards on screen.
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

/** Peer names past this are cut so they can't push the approval controls off screen. */
export const PEER_TEXT_MAX_LENGTH = 60

/**
 * A dApp-asserted string (peer name, passkey user name) made safe to render:
 * no bidi controls, whitespace collapsed to one line, and clamped to
 * `maxLength` code points with an ellipsis.
 */
export const toPeerDisplayText = (
    value: string | null | undefined,
    maxLength: number = PEER_TEXT_MAX_LENGTH,
): string => {
    const cleaned = (value ?? '')
        .replace(BIDI_CONTROLS, '')
        .replace(/\s+/g, ' ')
        .trim()
    const codePoints = Array.from(cleaned)
    if (codePoints.length <= maxLength) return cleaned
    return `${codePoints
        .slice(0, maxLength - 1)
        .join('')
        .trimEnd()}…`
}

/**
 * The host of a dApp-asserted URL for display. On web, `URL` serialises the
 * host in its ASCII (punycode) form, the same form the extension's origin
 * comparisons use, so a homoglyph host (`apple.com` spelled with a Cyrillic
 * `a`) reads as `xn--pple-43d.com` instead of passing for the real one. React
 * Native's `URL` is regex-based and returns the host as written.
 */
export const toPeerHostLabel = (
    url: string | null | undefined,
): string | undefined => {
    if (!url) return undefined
    try {
        const { host } = new URL(url)
        if (host) return host
    } catch {
        // Not a URL; fall through to the cleaned raw string.
    }
    return toPeerDisplayText(stripUrlScheme(url)) || undefined
}
