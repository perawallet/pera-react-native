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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { type Nullable } from '@perawallet/wallet-core-shared'
import type { Decimal } from 'decimal.js'

/** What a chain restricts about a holding, in terms every chain shares. */
export const HoldingRestrictions = {
    /** The holding can neither send nor receive. */
    transferBlocked: 'transferBlocked',
} as const

export type HoldingRestriction =
    (typeof HoldingRestrictions)[keyof typeof HoldingRestrictions]

export type AssetWithAccountBalance = {
    assetId: string
    asset?: PeraAsset
    /** Asset amount in display units (divided by 10^decimals) */
    amount: Decimal
    /**
     * Value of this holding in the chain's native asset (display units);
     * `null` when it can't be priced against the native asset, so it is
     * unknown, not 0. The native holding itself is always its amount.
     */
    nativeValue: Nullable<Decimal>
    /** USD price per whole unit of the asset, joined from the DB read. */
    usdPrice?: Decimal
    /**
     * Holding value in USD (display units); `null` when the asset has no known
     * USD price or its decimals haven't synced, so it is unknown, not 0.
     */
    fiatValue: Nullable<Decimal>
    /** `null` when the chain places no restriction on the holding. */
    restriction: Nullable<HoldingRestriction>
}

export type AccountBalancesWithTotals = {
    accountBalances: AccountBalances
    /** `null` when any account's `nativeValue` is. */
    portfolioNativeValue: Nullable<Decimal>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

export type AccountBalance = {
    assetBalances: AssetWithAccountBalance[]
    /**
     * Total in the native asset (display units); `null` once a second chain is
     * registered and priced holdings can't be converted for want of a native
     * price — see `valueAccountTotals`.
     */
    nativeValue: Nullable<Decimal>
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
 * One account's totals on one chain. Chain-qualified because EVM chains derive
 * the same address, so an address alone would let one chain's entry overwrite
 * another's. Branded so a key can only come from `accountValueKey`.
 */
export type AccountValueKey = `${ChainId}|${string}` & {
    readonly __accountValueKey: unique symbol
}

export const accountValueKey = (
    chainId: ChainId,
    address: string,
): AccountValueKey => `${chainId}|${address}` as AccountValueKey

/**
 * Per-chain values for ranking accounts: the native value within one chain,
 * the fiat value across chains. Structural on purpose: any map of this shape
 * satisfies it, such as `useAccountValueTotalsQuery`'s totals map.
 */
export type AccountValues = Map<
    AccountValueKey,
    Pick<AccountBalance, 'nativeValue' | 'fiatValue'>
>

export type PortfolioValueHistoryItem = {
    datetime: Date
    /** `null` when the preferred-currency rate is unresolved — not 0. */
    preferredValue: Nullable<Decimal>
}

export type AccountBalanceHistoryItem = PortfolioValueHistoryItem & {
    /** Display units of the chain's native asset; `null` across several chains, whose native assets don't add. */
    nativeValue: Nullable<Decimal>
}

export type AccountAssetBalanceHistoryItem = {
    datetime: Date
    /** Asset amount held at this point, in display units */
    amount: Decimal
    /** `null` when the preferred-currency rate is unresolved — not 0. */
    preferredValue: Nullable<Decimal>
}
