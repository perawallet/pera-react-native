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

import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { type Nullable } from '@perawallet/wallet-core-shared'
import type { Decimal } from 'decimal.js'

export type AssetWithAccountBalance = {
    assetId: string
    asset?: PeraAsset
    /** Asset amount in display units (divided by 10^decimals) */
    amount: Decimal
    /** Value of this holding in ALGOs (display units) */
    algoValue: Decimal
    /** USD price per whole unit of the asset, joined from the DB read. */
    usdPrice?: Decimal
    /**
     * Holding value in USD (display units); `null` when the asset has no known
     * USD price or its decimals haven't synced, so it is unknown, not 0.
     */
    fiatValue: Nullable<Decimal>
    /** Holding-level freeze from algod — frozen assets can't be transferred. */
    isFrozen: boolean
}

export type AccountBalancesWithTotals = {
    accountBalances: AccountBalances
    portfolioAlgoValue: Decimal
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

export type AccountBalance = {
    assetBalances: AssetWithAccountBalance[]
    algoValue: Decimal
    /** Total value of the account's holdings in USD (display units). */
    usdValue: Decimal
    /**
     * Account value in USD (display units); `null` when the native asset is
     * held but unpriced. A non-native holding without a price adds nothing.
     */
    fiatValue: Nullable<Decimal>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountBalances = Map<string, AccountBalance>

/**
 * Per-address ALGO-denominated values — the minimal shape balance-ranking
 * consumers (e.g. `useSortedAccounts`) need. Structural on purpose: both the
 * full `AccountBalances` map and `useAccountValueTotalsQuery`'s cheap totals
 * map satisfy it.
 */
export type AccountAlgoValues = Map<string, Pick<AccountBalance, 'algoValue'>>

/**
 * Per-address fiat values for ranking and summing across chains;
 * `AccountBalances` and `AccountValueTotalsMap` both satisfy it.
 */
export type AccountFiatValues = Map<string, Pick<AccountBalance, 'fiatValue'>>

export type AccountBalanceResponse = {
    results: AccountAssetBalanceResponse[]
}

export type AccountAssetBalanceResponse = {
    asset_id: string
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    amount: string
    fraction_decimals: number
    balance_usd_value: string
}

export type AccountBalanceHistoryItem = {
    datetime: Date
    /** `null` when the preferred-currency rate is unresolved — not 0. */
    preferredValue: Nullable<Decimal>
    algoValue: Decimal
    round: number
}

export type AccountBalanceHistoryResponseItem = {
    datetime: string
    usd_value: string
    algo_value: string
    round: number
}

export type AccountBalanceHistoryResponse = {
    results: AccountBalanceHistoryResponseItem[]
}

export type AccountAssetBalanceHistoryItem = {
    datetime: Date
    /** Asset amount held at this point, in display units */
    amount: Decimal
    /** `null` when the preferred-currency rate is unresolved — not 0. */
    preferredValue: Nullable<Decimal>
    round: number
}

export type AccountAssetsBalanceHistory = AccountAssetBalanceHistoryItem[]

export type AccountAssetBalanceHistoryResponseItem = {
    datetime: string
    /** Asset amount in display units — this endpoint has no algo_value field */
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    amount: string
    usd_value: string
    round: number
}

export type AccountAssetBalanceHistoryResponse = {
    results: AccountAssetBalanceHistoryResponseItem[]
}
