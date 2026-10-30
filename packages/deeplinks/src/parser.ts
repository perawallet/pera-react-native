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

import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { isWalletConnectScheme } from '@perawallet/wallet-core-walletconnect/shared/deeplink'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { linkFromIntent } from './chain-links'
import {
    FIDO_SCHEME,
    LIQUID_SCHEME,
    PERAWALLET_SCHEME,
    PERAWALLET_WC_SCHEME,
} from './constants'
import { DeeplinkType, linkTargetOf, type AnyParsedDeeplink } from './links'
import { parsePerawalletAppUri } from './new-parser'
import { parsePerawalletUri } from './old-parser'
import { peraLinkChainFailure } from './pera-link-chain'
import { resolveChainDeeplink } from './resolve'
import { getUniversalLinkPath, normalizeUrl } from './utils'
import { parseWalletConnectDeeplink } from './wallet-connect'

// A present-but-invalid account is corruption (a truncated QR) or injection, so
// the whole link is rejected. Checked on the final result: that also covers the
// legacy path-form address, and a per-parser null would fall through to HOME.
const hasValidAddressesOnTarget = (link: AnyParsedDeeplink): boolean => {
    const target = linkTargetOf(link)
    if (!target) return true

    const addresses = [
        'address' in link ? link.address : undefined,
        'receiverAddress' in link ? link.receiverAddress : undefined,
        link.type === DeeplinkType.CHAIN_ACTION
            ? link.chainData.sender
            : undefined,
    ].filter((value): value is string => !!value)
    if (addresses.length === 0) return true

    if (!addressCodecs.has(target.chainId)) return false
    const codec = addressCodecs.get(target.chainId)
    return addresses.every(value => codec.isValid(value, target.networkId))
}

/**
 * Parse Universal Links: https://perawallet.app/...
 *
 * Path conventions mirror the pera-android AndroidManifest so QR codes and
 * shared links resolve identically across native apps and this RN build:
 *   /qr/perawallet/app/<action>?...  → perawallet://app/<action>?...
 *   /qr/perawallet/<rest>             → perawallet://<rest>
 *   /qr/perawallet-wc/<rest>          → perawallet-wc://<rest>
 */
const parseUniversalLink = (path: string): Nullable<AnyParsedDeeplink> => {
    const appPrefix = `/qr/${PERAWALLET_SCHEME}/app/`
    const wcPrefix = `/qr/${PERAWALLET_WC_SCHEME}/`
    const legacyPrefix = `/qr/${PERAWALLET_SCHEME}/`

    if (path.startsWith(appPrefix)) {
        return parsePerawalletAppUri(
            `${PERAWALLET_SCHEME}://app/${path.slice(appPrefix.length)}`,
        )
    } else if (path.startsWith(wcPrefix)) {
        const wcUrl = `${PERAWALLET_WC_SCHEME}://${path.slice(wcPrefix.length)}`
        return parseWalletConnectDeeplink(wcUrl, wcUrl)
    } else if (path.startsWith(legacyPrefix)) {
        return parsePerawalletUri(
            `${PERAWALLET_SCHEME}://${path.slice(legacyPrefix.length)}`,
        )
    }

    return null
}

/**
 * Legacy recover-account QR from native pera-android / pera-ios: raw JSON
 * `{"version":1,"mnemonic":"..."}` with no scheme. `sourceUrl` is dropped:
 * the payload IS the mnemonic.
 */
const parseLegacyMnemonicJson = (url: string): Nullable<AnyParsedDeeplink> => {
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
            sourceUrl: '',
            mnemonic: parsed.mnemonic,
        }
    } catch {
        return null
    }
}

const parseUncheckedDeeplink = (url: string): Nullable<AnyParsedDeeplink> => {
    if (!url || typeof url !== 'string') return null

    // Raw JSON, not a URI, so it goes before the URL-based parsers.
    const mnemonicJson = parseLegacyMnemonicJson(url)
    if (mnemonicJson) return mnemonicJson

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

    if (isWalletConnectScheme(url)) {
        return parseWalletConnectDeeplink(url, url)
    }

    // Ahead of the Pera parsers: a chain URI such as `<scheme>://net:testnet/app/1`
    // contains `/app/`. A claimed link that fails never falls through to them,
    // or it would land on HOME. Several candidates (a raw address more than one
    // codec accepts) is a choice the caller owes the user, so it parses to nothing.
    const resolution = resolveChainDeeplink(url)
    if (resolution.status === 'resolved') {
        const [intent, ...others] = resolution.intents
        return others.length === 0 ? linkFromIntent(intent, url) : null
    }
    if (resolution.status === 'failed') return null

    // Otherwise the legacy `perawallet://` parser below would read it as HOME.
    if (peraLinkChainFailure(url)) return null

    const universalLinkPath = getUniversalLinkPath(url)
    if (universalLinkPath !== null) {
        return parseUniversalLink(universalLinkPath)
    }

    if (normalizedUrl.includes('/app/')) {
        const result = parsePerawalletAppUri(url)
        if (result) return result
    }

    if (normalizedUrl.startsWith(`${PERAWALLET_SCHEME}://`)) {
        const result = parsePerawalletUri(url)
        if (result) return result
    }

    return null
}

export const parseDeeplink = (url: string): Nullable<AnyParsedDeeplink> => {
    const parsed = parseUncheckedDeeplink(url)
    return parsed && hasValidAddressesOnTarget(parsed) ? parsed : null
}
