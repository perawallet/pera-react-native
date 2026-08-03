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
 * Parse query parameters from a URL
 */
export const parseQueryParams = (url: string): Record<string, string> => {
    const params: Record<string, string> = {}

    try {
        const urlObj = new URL(
            url.replace(/^([a-z-]+):\/\/(?!\/)/, '$1://placeholder/'),
        )
        urlObj.searchParams.forEach((value, key) => {
            // Defensive trim: real-world deeplinks have shown stray
            // whitespace (e.g. `?address= BB4A...` from QR generators or
            // copy/paste). Address validators reject any whitespace, so a
            // single space silently kills an otherwise-valid handler. The
            // trim is safe because none of our supported params (address,
            // assetId, amount, mnemonic, etc.) carry semantically meaningful
            // leading or trailing whitespace.
            params[key] = decodeURIComponent(value).trim()
        })
    } catch {
        // Fallback for malformed URLs
        const queryStart = url.indexOf('?')
        if (queryStart === -1) return params

        const queryString = url.slice(queryStart + 1)
        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=')
            if (key) {
                params[key] = value ? decodeURIComponent(value).trim() : ''
            }
        })
    }

    return params
}

/**
 * ARC-90: assetid = 1*DIGIT. Asset IDs are uint64, so a valid id is
 * digits-only — this rejects negatives and non-numerics at the parse
 * boundary rather than letting them fail later at BigInt(assetId), past
 * the account picker and confirm sheet. Matches the ARC-90 path-form rule
 * and both native apps (android toLongOrNull, iOS Int64).
 */
export const isValidAssetId = (assetId: string): boolean =>
    /^\d+$/.test(assetId)

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
