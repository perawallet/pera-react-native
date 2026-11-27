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
    PeraAssetType,
    PeraAssetVerificationTier,
    type ScopedAssetSearchResult,
} from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'

/** An NFT or a name (an NFD is a collectible too): not something Markets lists. */
export const isCollectibleResult = ({
    asset,
}: ScopedAssetSearchResult): boolean =>
    asset.peraMetadata?.type === PeraAssetType.collectible ||
    asset.peraMetadata?.collectible !== undefined

// Lower sorts first. A collectible goes last whatever its tier: it is never the token searched for.
const groupOf = (result: ScopedAssetSearchResult): number => {
    if (isCollectibleResult(result)) return 3
    const tier = result.asset.peraMetadata?.verificationTier
    if (tier === PeraAssetVerificationTier.verified) return 0
    if (tier === PeraAssetVerificationTier.suspicious) return 2
    return 1
}

const isWordChar = (char: string): boolean => /[\p{L}\p{N}]/u.test(char)

const startsAWord = (text: Optional<string>, needle: string): boolean => {
    const haystack = (text ?? '').toLowerCase()
    let at = haystack.indexOf(needle)
    while (at !== -1) {
        if (at === 0 || !isWordChar(haystack[at - 1] ?? '')) return true
        at = haystack.indexOf(needle, at + 1)
    }
    return false
}

/**
 * The search service matches loosely, so it also answers with assets that only
 * resemble the query. A verified asset stays whatever it matched on; any other
 * has to carry the query at the start of a word of its name or symbol, or as
 * its id, so an unvetted near-match never fills the list.
 */
export const isRelevantSearchResult = (
    { asset }: ScopedAssetSearchResult,
    query: string,
): boolean => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return true
    if (
        asset.peraMetadata?.verificationTier ===
        PeraAssetVerificationTier.verified
    ) {
        return true
    }
    return (
        asset.assetId.toLowerCase() === needle ||
        startsAWord(asset.name, needle) ||
        startsAWord(asset.unitName, needle)
    )
}

const isExactMatch = (
    { asset }: ScopedAssetSearchResult,
    needle: string,
): boolean =>
    asset.name?.trim().toLowerCase() === needle ||
    asset.unitName?.trim().toLowerCase() === needle

/**
 * The search answers one chain after another, so a verified token can arrive
 * below another chain's unverified lookalikes. This orders one result list:
 * verified tokens, then unverified, then suspicious, then collectibles; inside
 * a group an exact name or symbol match leads, and the rest keep their order.
 */
export const rankSearchAssets = (
    results: readonly ScopedAssetSearchResult[],
    query: string,
): ScopedAssetSearchResult[] => {
    const needle = query.trim().toLowerCase()
    return results
        .map((result, index) => ({
            result,
            index,
            group: groupOf(result),
            exact: isExactMatch(result, needle) ? 0 : 1,
        }))
        .sort(
            (a, b) =>
                a.group - b.group || a.exact - b.exact || a.index - b.index,
        )
        .map(({ result }) => result)
}
