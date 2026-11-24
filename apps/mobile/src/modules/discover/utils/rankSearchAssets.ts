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
