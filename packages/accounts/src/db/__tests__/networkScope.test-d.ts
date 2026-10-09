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

import { describe, expectTypeOf, it } from 'vitest'
import type {
    ChainScope,
    ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    getAccountChainStateRow,
    upsertAccountChainState,
} from '../chainStateRepository'
import {
    getAccountCollectiblesLite,
    getAccountHoldingsLite,
    getAccountHoldingsPage,
} from '../holdingsQueries'
import {
    addToAssetHolding,
    deleteAssetHoldings,
    getAccountHoldings,
    getAllHeldAssetIdsForNetwork,
    getAssetHolderAddresses,
    insertAssetHolding,
    isAssetFrozen,
    refreshAccountHoldings,
} from '../holdingsRepository'
import { getAccountPortfolioTotals } from '../portfolioQueries'
import { AccountAssetHoldingsSchema, AccountChainStateSchema } from '../schema'

type ScopeOf<F extends (params: never) => unknown> = Parameters<F>[0] extends {
    scope: infer S
}
    ? S
    : never

describe('accounts repositories take a ChainScope', () => {
    it('types every network parameter as a ChainScope', () => {
        expectTypeOf<
            ScopeOf<typeof upsertAccountChainState>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAccountChainStateRow>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof refreshAccountHoldings>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof insertAssetHolding>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof addToAssetHolding>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAccountHoldings>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof isAssetFrozen>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof deleteAssetHoldings>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAllHeldAssetIdsForNetwork>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAssetHolderAddresses>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAccountHoldingsPage>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAccountHoldingsLite>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAccountCollectiblesLite>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAccountPortfolioTotals>
        >().toEqualTypeOf<ChainScope>()
    })

    it('rejects a bare network string', () => {
        expectTypeOf<'mainnet'>().not.toExtend<ChainScope>()
        expectTypeOf<string>().not.toExtend<ChainScope>()
        // @ts-expect-error a network name is not a scope
        void getAccountChainStateRow({ accountAddress: 'A', scope: 'mainnet' })
        void getAccountChainStateRow({
            accountAddress: 'A',
            // @ts-expect-error a network key is not accepted
            network: 'mainnet',
        })
        // @ts-expect-error a network name is not a scope
        void getAllHeldAssetIdsForNetwork({ scope: 'mainnet' })
        // @ts-expect-error a network key is not accepted
        void getAllHeldAssetIdsForNetwork({ network: 'mainnet' })
    })

    it('brands both network columns as scope keys', () => {
        expectTypeOf(
            AccountAssetHoldingsSchema.network._.data,
        ).toEqualTypeOf<ChainScopeKey>()
        expectTypeOf(
            AccountChainStateSchema.network._.data,
        ).toEqualTypeOf<ChainScopeKey>()
    })
})
