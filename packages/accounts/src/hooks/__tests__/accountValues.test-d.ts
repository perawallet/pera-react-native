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
import type { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    AccountBalances,
    AccountValues,
    AssetWithAccountBalance,
} from '../../models'
import type {
    AccountValueTotals,
    AccountValueTotalsMap,
} from '../useAccountValueTotalsQuery'

describe('account value types', () => {
    it('lets the totals map satisfy AccountValues, but not the address-keyed balances map', () => {
        expectTypeOf<AccountValueTotalsMap>().toExtend<AccountValues>()
        expectTypeOf<AccountBalances>().not.toExtend<AccountValues>()
    })

    it('keeps fiatValue to exactly null or a Decimal', () => {
        expectTypeOf<AssetWithAccountBalance['fiatValue']>().toEqualTypeOf<
            Nullable<Decimal>
        >()
        expectTypeOf<AccountValueTotals['fiatValue']>().toEqualTypeOf<
            Nullable<Decimal>
        >()
    })

    it('keeps a holding nativeValue to exactly null or a Decimal', () => {
        expectTypeOf<AssetWithAccountBalance['nativeValue']>().toEqualTypeOf<
            Nullable<Decimal>
        >()
    })
})
