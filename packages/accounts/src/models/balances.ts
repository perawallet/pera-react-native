/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import Decimal from 'decimal.js'

export type AssetWithAccountBalance = {
    assetId: string
    amount: Decimal
    algoValue: Decimal
    fiatValue: Decimal
}

export type AccountBalancesWithTotals = {
    accountBalances: AccountBalances
    portfolioAlgoValue: Decimal
    portfolioFiatValue: Decimal
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountBalance = {
    assetBalances: AssetWithAccountBalance[]
    algoValue: Decimal
    fiatValue: Decimal
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
    fiatValue: Decimal
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
    fiatValue: Decimal
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
    next: string | null
    previous: string | null
    results: AccountAssetBalanceHistoryResponseItem[]
}
