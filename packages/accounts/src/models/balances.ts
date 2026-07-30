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

import { type PeraAsset } from '@perawallet/wallet-core-assets'
import { type Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type AssetWithAccountBalance = {
    assetId: string
    asset?: PeraAsset
    /** Asset amount in display units (divided by 10^decimals) */
    amount: Decimal
    /** Value of this holding in ALGOs (display units) */
    algoValue: Decimal
    /** USD price per whole unit of the asset, joined from the DB read. */
    usdPrice?: Decimal
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
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountBalances = Map<string, AccountBalance>

export type AccountBalanceResponse = {
    results: AccountAssetBalanceResponse[]
}

export type AccountAssetBalanceResponse = {
    asset_id: string
    amount: string
    fraction_decimals: number
    balance_usd_value: string
}

export type AccountBalanceHistoryItem = {
    datetime: Date
    preferredValue: Decimal
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
    datetime: string
    algoValue: Decimal
    preferredValue: Decimal
    round: number
}

export type AccountAssetsBalanceHistory = AccountAssetBalanceHistoryItem[]

export type AccountAssetBalanceHistoryResponseItem = {
    datetime: string
    algo_value: string
    usd_value: string
    round: number
}

export type AccountAssetBalanceHistoryResponse = {
    next: Nullable<string>
    previous: Nullable<string>
    results: AccountAssetBalanceHistoryResponseItem[]
}
