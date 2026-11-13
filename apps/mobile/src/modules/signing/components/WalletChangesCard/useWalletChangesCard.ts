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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import type { BalanceImpactItem } from '../BalanceImpactSummary'

// Under one cent (or 0.01 of the native preferred currency) the swap is value-neutral.
const NEUTRAL_BELOW = new Decimal('0.01')

export type UseWalletChangesCardResult = {
    /** Received minus sent, in the preferred currency; null when either side can't be valued. */
    netChange: Nullable<Decimal>
    isNetNeutral: boolean
}

const NO_NET: UseWalletChangesCardResult = {
    netChange: null,
    isNetNeutral: false,
}

// An NFT has no price, and a full-balance row understates what leaves.
const usdValueOf = (items: readonly BalanceImpactItem[]): Nullable<Decimal> => {
    let total = new Decimal(0)
    for (const item of items) {
        if (item.isCollectible || item.isFullBalance || !item.usdPrice) {
            return null
        }
        total = total.plus(item.amount.times(item.usdPrice))
    }
    return total
}

/** A net change only means something when value goes both ways, as in a swap or a supply. */
export const useWalletChangesCard = (
    spend: readonly BalanceImpactItem[],
    receive: readonly BalanceImpactItem[],
): UseWalletChangesCardResult => {
    const { usdToPreferred } = useCurrency(useHomeChainScope())

    return useMemo(() => {
        if (spend.length === 0 || receive.length === 0) return NO_NET
        const sent = usdValueOf(spend)
        const received = usdValueOf(receive)
        if (sent === null || received === null) return NO_NET
        const netChange = usdToPreferred(received.minus(sent))
        if (netChange === null) return NO_NET
        return {
            netChange,
            isNetNeutral: netChange.abs().lessThan(NEUTRAL_BELOW),
        }
    }, [spend, receive, usdToPreferred])
}
