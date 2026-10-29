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
    isWalletConnectScheme,
    parseWalletConnectUri,
} from '@perawallet/wallet-core-walletconnect/shared/deeplink'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { DeeplinkType, type WalletConnectDeeplink } from './links'
import { resolveChainDeeplink } from './resolve'

export const parseWalletConnectDeeplink = (
    uri: string,
    sourceUrl: string,
): Nullable<WalletConnectDeeplink> => {
    const link = parseWalletConnectUri(uri)
    if (!link) return null
    return {
        type: DeeplinkType.WALLET_CONNECT,
        sourceUrl,
        uri: link.uri,
        browserName: link.browserName,
    }
}

/**
 * The `wc:` URI a link carries, or undefined when it isn't a WalletConnect
 * link. A chain's own wrapper scheme counts: its adapter unwraps it.
 */
export const walletConnectUriOf = (url: string): Optional<string> => {
    if (isWalletConnectScheme(url)) return url

    const resolution = resolveChainDeeplink(url)
    if (resolution.status !== 'resolved') return undefined
    for (const intent of resolution.intents) {
        if (intent.kind === 'wallet-connect') return intent.uri
    }
    return undefined
}
