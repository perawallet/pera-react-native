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
    type AddressActionsDeeplink,
    type AnyParsedDeeplink,
    DeeplinkType,
    type PeraWebImportDeeplink,
} from './types'
import { parsePerawalletAppUri } from './new-parser'
import { parsePerawalletUri } from './old-parser'
import { parseDevLocaleTourUri } from './dev-locale-tour-parser'
import { normalizeUrl } from './utils'
import { parseAlgorandUri } from './algorand-parser'
import { parseWalletConnectUri } from './walletconnect-parser'
import { parseCoinbaseFormat } from './coinbase-parser'
import {
    ALGO_SCHEME,
    ALGORAND_SCHEME,
    ALGORAND_WC_SCHEME,
    FIDO_SCHEME,
    LIQUID_SCHEME,
    PERAWALLET_SCHEME,
    PERAWALLET_UNIVERSAL_LINK_HOST,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
} from './constants'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    parsePeraWebQrPayload,
    PeraWebImportError,
} from '@perawallet/wallet-core-backup'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'

/**
 * Parse Universal Links: https://perawallet.app/...
 *
 * Path conventions mirror the pera-android AndroidManifest so QR codes and
 * shared links resolve identically across native apps and this RN build:
 *   /qr/perawallet/app/<action>?...  → perawallet://app/<action>?...
 *   /qr/perawallet/<rest>             → perawallet://<rest>
 *   /qr/perawallet-wc/<rest>          → perawallet-wc://<rest>
 */
const parseUniversalLink = (url: string): Nullable<AnyParsedDeeplink> => {
    const normalizedUrl = normalizeUrl(url)

    if (normalizedUrl.includes(`/qr/${PERAWALLET_SCHEME}/app/`)) {
        const convertedUrl = url.replace(
            `${PERAWALLET_UNIVERSAL_LINK_HOST}/qr/${PERAWALLET_SCHEME}/app/`,
            `${PERAWALLET_SCHEME}://app/`,
        )
        return parsePerawalletAppUri(convertedUrl)
    } else if (normalizedUrl.includes(`/qr/${PERAWALLET_WC_SCHEME}/`)) {
        const convertedUrl = url.replace(
            `${PERAWALLET_UNIVERSAL_LINK_HOST}/qr/${PERAWALLET_WC_SCHEME}/`,
            `${PERAWALLET_WC_SCHEME}://`,
        )
        return parseWalletConnectUri(convertedUrl)
    } else if (normalizedUrl.includes(`/qr/${PERAWALLET_SCHEME}/`)) {
        const convertedUrl = url.replace(
            `${PERAWALLET_UNIVERSAL_LINK_HOST}/qr/${PERAWALLET_SCHEME}/`,
            `${PERAWALLET_SCHEME}://`,
        )
        return parsePerawalletUri(convertedUrl)
    }

    return null
}

/**
 * Both supported JSON QR formats start with `{`, so we sniff the first
 * character to avoid running JSON.parse on every scanned barcode.
 *
 * Try the Pera Web import shape first (more specific — keyed `{backupId,
 * encryptionKey, ...}`); if that doesn't recognise the payload, fall back
 * to the legacy recover-account JSON shape (`{"version":1,"mnemonic":"..."}`)
 * emitted by older pera-android / pera-ios builds.
 */
const parseJsonQr = (url: string): Nullable<AnyParsedDeeplink> => {
    const trimmed = url.trim()
    if (!trimmed.startsWith('{')) return null

    const peraWeb = parsePeraWebJsonQr(trimmed)
    if (peraWeb) return peraWeb

    return parseLegacyMnemonicJson(trimmed)
}

/**
 * Pera Web "Transfer Accounts" QR. Raw JSON document with `backupId` +
 * 32-byte secretbox `encryptionKey`. The payload IS the secret — we drop
 * `sourceUrl` rather than echoing it back so a downstream logger /
 * breadcrumb can't leak the cipher key to a crash reporter.
 */
const parsePeraWebJsonQr = (
    trimmed: string,
): Nullable<PeraWebImportDeeplink> => {
    try {
        const parsed = parsePeraWebQrPayload(trimmed)
        return {
            type: DeeplinkType.PERA_WEB_IMPORT,
            sourceUrl: '',
            backupId: parsed.backupId,
            encryptionKey: parsed.encryptionKey,
        }
    } catch (error) {
        // Not a Pera Web QR (wrong shape, unsupported version, malformed
        // key). Caller falls back to the legacy mnemonic JSON parser.
        if (!(error instanceof PeraWebImportError)) {
            logger.warn('parsePeraWebJsonQr: unexpected error', { error })
        }
        return null
    }
}

/**
 * Legacy recover-account QR format from native pera-android / pera-ios:
 * the QR encodes a JSON document `{"version":1,"mnemonic":"word1 word2 ..."}`
 * directly (no scheme). Lifts the mnemonic out so the RECOVER_ADDRESS
 * dispatch path can handle it.
 *
 * `sourceUrl` is deliberately dropped (set to '') — the raw payload IS the
 * mnemonic, so echoing it back risks a downstream logger / error sheet
 * leaking the secret. Mirrors parsePeraWebJsonQr, whose payload is the
 * encryption key.
 */
const parseLegacyMnemonicJson = (
    trimmed: string,
): Nullable<AnyParsedDeeplink> => {
    if (!trimmed.endsWith('}')) return null
    try {
        const parsed = JSON.parse(trimmed) as {
            mnemonic?: unknown
            version?: unknown
        }
        if (typeof parsed.mnemonic !== 'string' || !parsed.mnemonic) {
            return null
        }
        return {
            type: DeeplinkType.RECOVER_ADDRESS,
            sourceUrl: '',
            mnemonic: parsed.mnemonic,
        }
    } catch {
        return null
    }
}

/**
 * Main deeplink parser - determines format and calls appropriate parser
 */
export const parseDeeplink = (url: string): Nullable<AnyParsedDeeplink> => {
    if (!url || typeof url !== 'string') return null

    if (isValidAlgorandAddress(url)) {
        return {
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: url,
            address: url,
        } as AddressActionsDeeplink
    }

    // JSON-shaped QRs (Pera Web import + legacy recover-account) — try
    // before the URL-based parsers since they're raw JSON, not URIs.
    const jsonResult = parseJsonQr(url)
    if (jsonResult) return jsonResult

    const normalizedUrl = normalizeUrl(url)

    if (normalizedUrl.startsWith(`${FIDO_SCHEME}:`)) {
        return {
            type: DeeplinkType.LIQUID_AUTH,
            variant: 'fido',
            sourceUrl: url,
            url,
        }
    }

    if (normalizedUrl.startsWith(`${LIQUID_SCHEME}:`)) {
        return {
            type: DeeplinkType.LIQUID_AUTH,
            variant: 'liquid',
            sourceUrl: url,
            url,
        }
    }

    if (
        normalizedUrl.startsWith(`${WC_SCHEME}:`) ||
        normalizedUrl.startsWith(`${PERAWALLET_WC_SCHEME}:`) ||
        normalizedUrl.startsWith(`${ALGORAND_WC_SCHEME}:`)
    ) {
        return parseWalletConnectUri(url)
    }

    if (normalizedUrl.startsWith(`${ALGORAND_SCHEME}://`)) {
        return parseAlgorandUri(url)
    }

    if (normalizedUrl.startsWith(`${ALGO_SCHEME}:`)) {
        return parseCoinbaseFormat(url)
    }

    if (normalizedUrl.startsWith(`${PERAWALLET_UNIVERSAL_LINK_HOST}/`)) {
        return parseUniversalLink(url)
    }

    if (normalizedUrl.includes('/app/')) {
        // Checked ahead of parsePerawalletAppUri: it owns the same
        // `perawallet://app/...` scheme but not this `dev/` path.
        const devLocaleTour = parseDevLocaleTourUri(url)
        if (devLocaleTour) return devLocaleTour

        const result = parsePerawalletAppUri(url)
        if (result) return result
    }

    if (normalizedUrl.startsWith(`${PERAWALLET_SCHEME}://`)) {
        const result = parsePerawalletUri(url)
        if (result) return result
    }

    return null
}
