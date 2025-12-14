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
    AnyParsedDeeplink,
} from './types'
import { parsePerawalletAppUri } from './new-parser'
import { parsePerawalletUri } from './old-parser'
import { normalizeUrl } from './utils'
import { parseAlgorandUri } from './algorand-parser'
import { parseWalletConnectUri } from './walletconnect-parser'


/**
 * Parse Universal Links: https://perawallet.app/...
 */
const parseUniversalLink = (url: string): AnyParsedDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith('https://perawallet.app/')) {
        return null
    }

    if (normalizedUrl.includes('/qr/perawallet/app/')) {
        const convertedUrl = url.replace('https://perawallet.app/qr/perawallet/app/', 'perawallet://app/')
        return parsePerawalletAppUri(convertedUrl)
    } else if (normalizedUrl.includes('/qr/perawallet/')) {
        const convertedUrl = url.replace('https://perawallet.app/qr/perawallet/', 'perawallet://')
        return parsePerawalletUri(convertedUrl)
    }

    return null
}

/**
 * Main deeplink parser - determines format and calls appropriate parser
 */
export const parseDeeplink = (url: string): AnyParsedDeeplink | null => {
    if (!url || typeof url !== 'string') return null

    const normalizedUrl = normalizeUrl(url)

    if (normalizedUrl.startsWith('wc:') || normalizedUrl.startsWith('perawallet-wc:')) {
        return parseWalletConnectUri(url)
    }

    if (normalizedUrl.startsWith('algorand://')) {
        return parseAlgorandUri(url)
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
