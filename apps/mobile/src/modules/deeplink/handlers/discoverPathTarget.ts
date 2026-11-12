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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'

export type DiscoverPathTarget =
    | { kind: 'home' }
    | { kind: 'webview'; path: string }
    | { kind: 'asset'; assetId: string; chainId: ChainId }

// Discover's token-detail paths predate multichain and always mean Algorand
const DISCOVER_TOKEN_DETAIL_CHAIN: ChainId = 'algorand'

const TOKEN_DETAIL_PREFIX = 'token-detail/'

/**
 * Decides where a DISCOVER_PATH deeplink lands. The path is normalised
 * (one leading slash, query and fragment) for matching only; WebView
 * targets keep the original path.
 */
export const discoverPathTarget = (
    path: Optional<string>,
): DiscoverPathTarget => {
    const normalised = (path ?? '').replace(/^\//, '').split(/[?#]/)[0]
    if (normalised === '' || normalised === 'main/home') {
        return { kind: 'home' }
    }
    if (normalised.startsWith(TOKEN_DETAIL_PREFIX)) {
        const id = normalised.slice(TOKEN_DETAIL_PREFIX.length)
        if (id === 'ALGO') {
            return {
                kind: 'asset',
                assetId: nativeAssetFor(DISCOVER_TOKEN_DETAIL_CHAIN).assetId,
                chainId: DISCOVER_TOKEN_DETAIL_CHAIN,
            }
        }
        if (/^\d+$/.test(id)) {
            return {
                kind: 'asset',
                assetId: id,
                chainId: DISCOVER_TOKEN_DETAIL_CHAIN,
            }
        }
    }
    return { kind: 'webview', path: path as string }
}
