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
import { hiddenAssetIdsOf, useHiddenTokensStore } from '../store/hiddenTokens'
import { AccountAssetHoldingsSchema } from './schema'
import type { AccountHoldingSource } from './holdingsQueries'

// The hidden set is a persisted store so cloud backup can sync it, so it is
// read when the statement is built. An opt-in chain's assets are never
// hideable, so an entry under one hides nothing.
export const hiddenHoldingSql = (
    sources: readonly AccountHoldingSource[],
): SQL => {
    const { hiddenTokens } = useHiddenTokensStore.getState()
    const hidden = sources.flatMap(({ address, scope }) => {
        const assetIds = hiddenAssetIdsOf(hiddenTokens, address, scope)
        if (assetIds.length === 0 || isOptInChain(scope.chainId)) return []
        return and(
            eq(AccountAssetHoldingsSchema.accountAddress, address),
            eq(AccountAssetHoldingsSchema.scope, toScopeKey(scope)),
            inArray(AccountAssetHoldingsSchema.assetId, [...assetIds]),
        )!
    })
    return hidden.length > 0 ? or(...hidden)! : sql`0`
}
