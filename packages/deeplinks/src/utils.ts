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

import { Decimal } from 'decimal.js'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'
import {
    PERAWALLET_SCHEME,
    PERAWALLET_UNIVERSAL_LINK_HOST,
    PERAWALLET_WC_SCHEME,
} from './constants'

// A percent sign that isn't a valid escape (`?label=100%`) makes
// `decodeURIComponent` throw, and the fallback below is inside the catch, so it
// would throw the same way straight out of the function. Callers read an
// undecodable param, not an exception.
//
// Defensive trim: real-world deeplinks have shown stray whitespace (e.g.
// `?address= BB4A...` from QR generators or copy/paste). Address validators
// reject any whitespace, so a single space silently kills an otherwise-valid
// handler. The trim is safe because none of our supported params (address,
// assetId, amount, mnemonic, etc.) carry semantically meaningful leading or
// trailing whitespace.
const decodeParam = (value: string): string => {
    try {
        return decodeURIComponent(value).trim()
    } catch {
        return value.trim()
    }
}

/**
 * Parse query parameters from a URL
 */
export const parseQueryParams = (url: string): Record<string, string> => {
    const params: Record<string, string> = {}

    try {
        const urlObj = new URL(
            url.replace(/^([a-z-]+):\/\/(?!\/)/, '$1://placeholder/'),
        )
        urlObj.searchParams.forEach((value, key) => {
            params[key] = decodeParam(value)
        })
    } catch {
        // Fallback for malformed URLs
        const queryStart = url.indexOf('?')
        if (queryStart === -1) return params

        const queryString = url.slice(queryStart + 1)
        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=')
            if (key) {
                params[key] = value ? decodeParam(value) : ''
            }
        })
    }

    return params
}

/**
 * Digits only: amounts and fees are unsigned integers in base units, so this
 * rejects negatives, fractions and non-numerics at the parse boundary rather
 * than letting them fail later, past the account picker and confirm sheet.
 */
export const readBaseUnits = (raw: string): Optional<Decimal> =>
    /^\d+$/.test(raw) ? new Decimal(raw) : undefined

/**
 * Decode base64-encoded parameter
 */
export const decodeBase64Param = (param: string): string => {
    try {
        // Simple check for base64 characters (standard and URL-safe)
        if (!/^[A-Za-z0-9+/=_-]+$/.test(param)) {
            return param
        }
        return Buffer.from(param, 'base64').toString('utf-8')
    } catch {
        return param
    }
}

/**
 * Normalize URL by trimming and lowercasing only the scheme part
 * Preserves case in the rest of the URL (important for addresses)
 */
export const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/)
    if (schemeMatch) {
        return schemeMatch[1].toLowerCase() + ':' + schemeMatch[2]
    }
    return trimmed.toLowerCase()
}

/**
 * Path and query of a `https://perawallet.app/…` link, else null. Scheme and
 * host are case-insensitive; the path is not (addresses, base64).
 */
export const getUniversalLinkPath = (url: string): Nullable<string> => {
    const trimmed = url.trim()
    const origin = trimmed.slice(0, PERAWALLET_UNIVERSAL_LINK_HOST.length)
    const path = trimmed.slice(PERAWALLET_UNIVERSAL_LINK_HOST.length)
    return origin.toLowerCase() === PERAWALLET_UNIVERSAL_LINK_HOST &&
        path.startsWith('/')
        ? path
        : null
}

export const extractPath = (url: string): string => {
    try {
        const appIndex = url.indexOf('/app/')
        if (appIndex !== -1) {
            const pathStart = appIndex + 5 // length of '/app/'
            const queryIndex = url.indexOf('?', pathStart)
            return queryIndex !== -1
                ? url.slice(pathStart, queryIndex)
                : url.slice(pathStart)
        }
        return ''
    } catch {
        return ''
    }
}

const stripPrefix = (text: string, prefix: string): Nullable<string> =>
    text.startsWith(prefix) ? text.slice(prefix.length) : null

/**
 * The action and params of `perawallet://app/<action>` or
 * `https://perawallet.app/qr/perawallet/app/<action>`, else null.
 */
export const readPeraAppLink = (
    url: string,
): Nullable<{ action: string; params: Record<string, string> }> => {
    const universalPath = getUniversalLinkPath(url)
    const rest =
        universalPath !== null
            ? stripPrefix(universalPath, `/qr/${PERAWALLET_SCHEME}/app/`)
            : stripPrefix(normalizeUrl(url), `${PERAWALLET_SCHEME}://app/`)
    if (rest === null) return null

    const queryAt = rest.indexOf('?')
    const action = (queryAt === -1 ? rest : rest.slice(0, queryAt)).replace(
        /\/$/,
        '',
    )
    return {
        action,
        params: parseQueryParams(`${PERAWALLET_SCHEME}://app/${rest}`),
    }
}

// True when a URL targets a Pera-owned scheme/host but didn't resolve to a
// supported action — a recognized-but-unsupported deeplink. Callers stay
// silent on these (mirroring the QR scanner, which quietly re-arms on codes it
// doesn't handle) and only surface the invalid-URL toast for input that isn't
// aimed at Pera at all.
export const isPeraOwnedDeeplink = (url: string): boolean => {
    const normalized = normalizeUrl(url)
    return (
        normalized.startsWith(`${PERAWALLET_SCHEME}:`) ||
        normalized.startsWith(`${PERAWALLET_WC_SCHEME}:`) ||
        getUniversalLinkPath(url) !== null
    )
}
