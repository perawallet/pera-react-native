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
    | { kind: 'news' }
    | { kind: 'newsDetail'; newsId: string }
    | { kind: 'dapps' }
    /** A Discover web page with no native screen yet. */
    | { kind: 'unported'; path: string }
    | { kind: 'asset'; assetId: string; chainId: ChainId }

// Discover's token-detail paths predate multichain and always mean Algorand
const DISCOVER_TOKEN_DETAIL_CHAIN: ChainId = 'algorand'

const TOKEN_DETAIL_PREFIX = 'token-detail/'
const NEWS_PREFIX = 'news/'

/**
 * Decides where a DISCOVER_PATH deeplink lands on a multichain build, whose
 * Discover is native. The path is normalised (one leading slash, query and
 * fragment) for matching only; unported targets keep the original path.
 */
export const discoverPathTarget = (
    path: Optional<string>,
): DiscoverPathTarget => {
    const normalised = (path ?? '').replace(/^\//, '').split(/[?#]/)[0]
    if (normalised === '' || normalised === 'main/home') {
        return { kind: 'home' }
    }
    if (normalised === 'news') {
        return { kind: 'news' }
    }
    if (normalised.startsWith(NEWS_PREFIX)) {
        // The id is the first segment only; `news/` or `news//` has none.
        const newsId = normalised.slice(NEWS_PREFIX.length).split('/')[0]
        return newsId ? { kind: 'newsDetail', newsId } : { kind: 'news' }
    }
    if (normalised === 'main/browser') {
        return { kind: 'dapps' }
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
    return { kind: 'unported', path: path as string }
}
