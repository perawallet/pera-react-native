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

import type { AssetSearchPage } from '@perawallet/wallet-core-assets'
import type { Maybe, Network, Optional } from '@perawallet/wallet-core-shared'
import { searchAssets } from './api/search-endpoints'
import { transformSearchResult } from './api/search-mappers'

export const extractCursor = (nextUrl: Maybe<string>): Optional<string> => {
    if (!nextUrl) {
        return undefined
    }
    try {
        const url = new URL(nextUrl)
        return url.searchParams.get('cursor') ?? undefined
    } catch {
        return undefined
    }
}

type SearchAssetPageParams = {
    query: string
    network: Network
    cursor?: string
    hasCollectible?: boolean
}

export const searchAssetPage = async (
    params: SearchAssetPageParams,
): Promise<AssetSearchPage> => {
    const page = await searchAssets(params)
    return {
        results: page.results.map(transformSearchResult),
        nextCursor: extractCursor(page.next),
    }
}
