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
} from './types'
import { parsePerawalletAppUri } from './new-parser'
import { parsePerawalletUri } from './old-parser'
import { normalizeUrl } from './utils'
import { parseAlgorandUri } from './algorand-parser'
import { parseWalletConnectUri } from './walletconnect-parser'
import { parseCoinbaseFormat } from './coinbase-parser'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'

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

    if (normalizedUrl.includes('/qr/perawallet/app/')) {
        const convertedUrl = url.replace(
            'https://perawallet.app/qr/perawallet/app/',
            'perawallet://app/',
        )
        return parsePerawalletAppUri(convertedUrl)
    } else if (normalizedUrl.includes('/qr/perawallet-wc/')) {
        const convertedUrl = url.replace(
            'https://perawallet.app/qr/perawallet-wc/',
            'perawallet-wc://',
        )
        return parseWalletConnectUri(convertedUrl)
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
 * Legacy recover-account QR format from native pera-android / pera-ios:
 * the QR encodes a JSON document `{"version":1,"mnemonic":"word1 word2 ..."}`
 * directly (no scheme). Detect that shape and lift the mnemonic out so the
 * RECOVER_ADDRESS dispatch path can handle it.
 */
const parseLegacyMnemonicJson = (
    url: string,
): Nullable<AnyParsedDeeplink> => {
    const trimmed = url.trim()
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null
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
            sourceUrl: url,
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

    // Legacy native recover-account QR codes are raw JSON, no scheme — try
    // that before any scheme-based parsing.
    const legacyMnemonic = parseLegacyMnemonicJson(url)
    if (legacyMnemonic) return legacyMnemonic

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
