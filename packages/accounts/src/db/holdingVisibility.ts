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

import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { isOptInChain } from '../chainProtocol'
import { useHiddenTokensStore } from '../store/hiddenTokens'
import { useKeptTokensStore } from '../store/keptTokens'
import { assetIdsIn, type TokenSets } from '../store/tokenSets'
import { AccountAssetHoldingsSchema } from './schema'
import type { AccountHoldingSource } from './holdingsQueries'

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

export const keptHoldingSql = (sources: readonly AccountHoldingSource[]): SQL =>
    inTokenSetsSql(useKeptTokensStore.getState().keptTokens, sources)
