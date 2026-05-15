/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    AddressActionsDeeplink,
    AnyParsedDeeplink,
    DeeplinkType,
    PeraWebImportDeeplink,
} from './types'
import { parsePerawalletAppUri } from './new-parser'
import { parsePerawalletUri } from './old-parser'
import { normalizeUrl } from './utils'
import { parseAlgorandUri } from './algorand-parser'
import { parseWalletConnectUri } from './walletconnect-parser'
import { parseCoinbaseFormat } from './coinbase-parser'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    parsePeraWebQrPayload,
    PeraWebImportError,
} from '@perawallet/wallet-core-backup'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'

/**
 * Parse Universal Links: https://perawallet.app/...
 */
const parseUniversalLink = (url: string): Nullable<AnyParsedDeeplink> => {
    const normalizedUrl = normalizeUrl(url)

    if (normalizedUrl.includes('/qr/perawallet/app/')) {
        const convertedUrl = url.replace(
            'https://perawallet.app/qr/perawallet/app/',
            'perawallet://app/',
        )
        return parsePerawalletAppUri(convertedUrl)
    } else if (normalizedUrl.includes('/qr/perawallet/')) {
        const convertedUrl = url.replace(
            'https://perawallet.app/qr/perawallet/',
            'perawallet://',
        )
        return parsePerawalletUri(convertedUrl)
    }

    return null
}

/**
 * Detect the Pera Web "Transfer Accounts" QR shape. The QR is raw JSON
 * (`{backupId, encryptionKey, ...}`) rather than a perawallet:// URI, so it
 * doesn't fit any of the URL-based parsers. We sniff for a leading `{` to
 * avoid running JSON.parse on every scanned barcode.
 */
const parsePeraWebJsonQr = (url: string): Nullable<PeraWebImportDeeplink> => {
    const trimmed = url.trim()
    if (!trimmed.startsWith('{')) return null
    try {
        const parsed = parsePeraWebQrPayload(trimmed)
        return {
            type: DeeplinkType.PERA_WEB_IMPORT,
            sourceUrl: url,
            backupId: parsed.backupId,
            encryptionKey: parsed.encryptionKey,
        }
    } catch (error) {
        // JSON-shaped but not a Pera Web QR (wrong fields, unsupported
        // version, malformed key). Fall back to the other parsers — they'll
        // also return null, so the caller still sees "unrecognized QR".
        if (!(error instanceof PeraWebImportError)) {
            logger.warn('parsePeraWebJsonQr: unexpected error', { error })
        }
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

    // Pera Web QRs are JSON, not URIs — check before the URL-based parsers
    // so we don't fall through to "unrecognized" on a valid Pera Web scan.
    const peraWebResult = parsePeraWebJsonQr(url)
    if (peraWebResult) return peraWebResult

    const normalizedUrl = normalizeUrl(url)

    if (
        normalizedUrl.startsWith('wc:') ||
        normalizedUrl.startsWith('perawallet-wc:')
    ) {
        return parseWalletConnectUri(url)
    }

    if (normalizedUrl.startsWith('algorand://')) {
        return parseAlgorandUri(url)
    }

    if (normalizedUrl.startsWith('algo:')) {
        return parseCoinbaseFormat(url)
    }

    if (normalizedUrl.startsWith('https://perawallet.app/')) {
        return parseUniversalLink(url)
    }

    if (normalizedUrl.includes('/app/')) {
        const result = parsePerawalletAppUri(url)
        if (result) return result
    }

    if (normalizedUrl.startsWith('perawallet://')) {
        const result = parsePerawalletUri(url)
        if (result) return result
    }

    return null
}
