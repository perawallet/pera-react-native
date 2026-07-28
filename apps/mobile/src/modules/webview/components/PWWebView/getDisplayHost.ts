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

/**
 * Best-effort display host for a webview URL, or `undefined` when the URL has
 * no host to show.
 *
 * Used by the title bar, which renders before the WebView can surface a load
 * error, so it must never throw on a malformed or scheme-less input — an
 * unguarded `new URL()` previously crashed the title bar. Retries with an
 * `https://` prefix so a bare host (`example.com/x`) still resolves, then falls
 * back to the raw string when it still cannot be parsed.
 *
 * Opaque-origin schemes (`about:`, `data:`, `blob:`, `javascript:`) parse fine
 * but yield an EMPTY hostname, so they're reported as unresolved rather than
 * rendered as a blank label. A page can reach those via `location.href`, and a
 * blank origin line under a page-chosen title is worse than an explicit
 * "unknown" — the caller supplies that copy (PERA-4665).
 */
const OPAQUE_ORIGIN_SCHEMES = [
    'about:',
    'data:',
    'blob:',
    'javascript:',
    'file:',
]

export const getDisplayHost = (url: string): string | undefined => {
    const trimmed = url.trim()
    if (!trimmed) return undefined

    // These parse without throwing but carry no meaningful host, and echoing the
    // raw value would print an entire `data:` payload into the title bar.
    const lowered = trimmed.toLowerCase()
    if (OPAQUE_ORIGIN_SCHEMES.some(scheme => lowered.startsWith(scheme))) {
        return undefined
    }

    const hostFrom = (value: string): string | undefined => {
        try {
            return new URL(value).hostname || undefined
        } catch {
            return undefined
        }
    }

    return hostFrom(trimmed) ?? hostFrom(`https://${trimmed}`) ?? trimmed
}
