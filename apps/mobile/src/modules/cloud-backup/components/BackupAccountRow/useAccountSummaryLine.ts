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

import type { Decimal } from 'decimal.js'
import {
    useAccountHoldingsCountQuery,
    useAccountSummaryQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNativeAsset, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { useAccountWithBalance } from '@components/AccountWithBalance'

export type AccountSummaryValue =
    /** In the native asset, display units. */
    | { kind: 'native'; asset: PeraAsset; value: Nullable<Decimal> }
    /** In the preferred currency; `undefined` while loading, `null` when unknown. */
    | { kind: 'fiat'; value: Maybe<Decimal> }
    | { kind: 'none' }

type UseAccountSummaryLineResult = {
    holdingsCount: number
    value: AccountSummaryValue
}

/**
 * Reads the same cheap per-account SQL aggregates the account list already
 * warms. Once the wallet spans chains, the line counts and values the whole
 * account, matching the account overview's headline.
 */
export const useAccountSummaryLine = (
    account: WalletAccount,
    address: string,
    /** Where `address` lives, which the single-chain line is valued on. */
    scope: ChainScope,
): UseAccountSummaryLineResult => {
    const nativeAsset = useNativeAsset(scope)
    const algorand = useAccountSummaryQuery(address, scope)
    const { holdingsCount } = useAccountHoldingsCountQuery(account)
    const { crossChainTotal } = useAccountWithBalance(account)

    if (!crossChainTotal) {
        return {
            holdingsCount: algorand.holdingsCount,
            value: {
                kind: 'native',
                asset: nativeAsset,
                value: algorand.portfolioNativeValue,
            },
        }
    }
    return {
        holdingsCount,
        value:
            crossChainTotal.kind === 'fiat'
                ? { kind: 'fiat', value: crossChainTotal.value }
                : { kind: 'none' },
    }
}
