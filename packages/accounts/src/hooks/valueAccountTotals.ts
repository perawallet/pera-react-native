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

import { Decimal } from 'decimal.js'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { AccountPortfolioTotals } from '../db'

export type ValuedAccountTotals = {
    /** Native balance in display units (price-independent). */
    nativeAmount: Decimal
    /**
     * Account value expressed in the native asset (display units); `null` when
     * priced non-native holdings can't be converted for want of a native
     * price, and the caller asked for that to be unknown — see
     * `isUnconvertibleUnknown`.
     */
    nativeValue: Nullable<Decimal>
    /**
     * Account value in USD (display units); `null` when the native asset is
     * held but unpriced on a chain that should price it, so the value is
     * unknown, not 0.
     */
    usdValue: Nullable<Decimal>
    /**
     * Same contract as `AccountBalance.fiatValue`. Unlike `usdValue`, an
     * unpriced native balance is `null` regardless of `hasPricing`.
     */
    fiatValue: Nullable<Decimal>
    /**
     * USD (display units) of the holdings that have a price; an unpriced
     * native balance counts 0. Equals `fiatValue` whenever that is known, and
     * is the priced part of the value when it isn't.
     */
    pricedFiatValue: Decimal
}

/**
 * The values `useAccountSummaryQuery` and `useAccountValueTotalsQuery` both
 * derive from one account's SQL totals.
 *
 * The native asset counts at its raw amount in the native-denominated total
 * (1:1, price-independent); non-native holdings convert through the native
 * price, and drop out of that total while it is unknown.
 *
 * The USD total needs that price for any native amount held, so an install
 * that has never synced prices can't express it at all — `null`, not 0.
 * Pricing 10 of the native asset at $0.00 is the fake number the offline epic
 * forbids. A chain with no price source (`hasPricing` false) is excluded: a
 * zero price is the deliberate answer there, not a missing one.
 *
 * With `isUnconvertibleUnknown`, a native total that would silently drop
 * priced non-native holdings is `null` instead. Callers set it only once a
 * second chain is registered, so single-chain wallets keep today's figures.
 */
export const valueAccountTotals = (
    totals: Optional<AccountPortfolioTotals>,
    hasPricing: boolean,
    isUnconvertibleUnknown = false,
): ValuedAccountTotals => {
    const nativeAmount = totals?.nativeAmount ?? new Decimal(0)
    const nonNativeUsd = totals?.nonNativeUsdValue ?? new Decimal(0)
    const nativeUsdPrice = totals?.nativeUsdPrice ?? null
    const price = nativeUsdPrice ?? new Decimal(0)

    const usdTotal = nonNativeUsd.plus(nativeAmount.times(price))
    const nativeValue = !price.isZero()
        ? nativeAmount.plus(nonNativeUsd.div(price))
        : isUnconvertibleUnknown && !nonNativeUsd.isZero()
          ? null
          : nativeAmount

    return {
        nativeAmount,
        nativeValue,
        usdValue:
            price.isZero() && !nativeAmount.isZero() && hasPricing
                ? null
                : usdTotal,
        fiatValue:
            nativeUsdPrice === null && !nativeAmount.isZero() ? null : usdTotal,
        pricedFiatValue: usdTotal,
    }
}
