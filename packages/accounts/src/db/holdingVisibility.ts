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

import { and, eq, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm'
import {
    AssetsPeraSchema,
    findNativeAsset,
    PeraAssetType,
    PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { isOptInChain, receivesUnaskedAssets } from '../chainProtocol'
import { useHiddenTokensStore } from '../store/hiddenTokens'
import { useKeptTokensStore } from '../store/keptTokens'
import { assetIdsIn, type TokenSets } from '../store/tokenSets'
import { AccountAssetHoldingsSchema } from './schema'
import type { AccountHoldingSource } from './holdingsQueries'
import { isNotSuspiciousSql } from './holdingSuspicion'

const inTokenSetsSql = (
    sets: TokenSets,
    sources: readonly AccountHoldingSource[],
): SQL => {
    const matches = sources.flatMap(({ address, scope }) => {
        const assetIds = assetIdsIn(sets, address, scope)
        if (assetIds.length === 0 || isOptInChain(scope.chainId)) return []
        return and(
            eq(AccountAssetHoldingsSchema.accountAddress, address),
            eq(AccountAssetHoldingsSchema.scope, toScopeKey(scope)),
            inArray(AccountAssetHoldingsSchema.assetId, [...assetIds]),
        )!
    })
    return matches.length > 0 ? or(...matches)! : sql`0`
}

// The hidden and kept sets are persisted stores so cloud backup can sync
// them, so they are read when the statement is built. An opt-in chain's
// assets are never hideable, so an entry under one matches nothing.
export const hiddenHoldingSql = (
    sources: readonly AccountHoldingSource[],
): SQL => inTokenSetsSql(useHiddenTokensStore.getState().hiddenTokens, sources)

/**
 * Whether the default list shows the holding. On a chain that receives tokens
 * unasked that is the native coin, a token Pera verified, or one the address
 * kept; any other token waits in the inbox. An NFT, which the gallery filters
 * on its own, and any asset on an opt-in chain, which the user chose, are only
 * left out when Pera flags them suspicious and they aren't kept. Needs
 * `AssetsPeraSchema` left-joined on asset id and scope.
 */
export const approvedHoldingSql = (
    sources: readonly AccountHoldingSource[],
): SQL => {
    const { keptTokens } = useKeptTokensStore.getState()
    const matches = sources.map(({ address, scope }) => {
        const isSource = and(
            eq(AccountAssetHoldingsSchema.accountAddress, address),
            eq(AccountAssetHoldingsSchema.scope, toScopeKey(scope)),
        )!
        if (!receivesUnaskedAssets(scope.chainId)) {
            return and(isSource, isNotSuspiciousSql())!
        }
        const nativeId = findNativeAsset(scope.chainId)?.assetId
        const keptIds = assetIdsIn(keptTokens, address, scope)
        // `isNotNull` keeps each test false rather than NULL on a row with no
        // metadata, so negating this still matches that row.
        const approvals = [
            and(
                isNotNull(AssetsPeraSchema.verificationTier),
                eq(
                    AssetsPeraSchema.verificationTier,
                    PeraAssetVerificationTier.verified,
                ),
            )!,
            and(
                isNotNull(AssetsPeraSchema.assetType),
                eq(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                isNotSuspiciousSql(),
            )!,
            ...(nativeId
                ? [eq(AccountAssetHoldingsSchema.assetId, nativeId)]
                : []),
            ...(keptIds.length > 0
                ? [inArray(AccountAssetHoldingsSchema.assetId, [...keptIds])]
                : []),
        ]
        return and(isSource, or(...approvals))!
    })
    return matches.length > 0 ? or(...matches)! : sql`0`
}

/** Whether the holding counts toward a total: approved, and never a token Pera flags suspicious even if kept. */
export const countedHoldingSql = (
    sources: readonly AccountHoldingSource[],
): SQL => and(approvedHoldingSql(sources), isNotSuspiciousSql())!
