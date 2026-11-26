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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useOpenSwapOrders,
    type SwapTrackedAsset,
} from '@perawallet/wallet-core-swaps'
import type { LeadingAsset } from '@components/TransactionLeadingIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapAccountAddresses } from '../../hooks/useSwapAccountAddresses'
import { swapAssetUnit } from '../../utils/swapPairLabel'

export type PendingSwapRow = {
    orderId: string
    title: string
    subtitle: string
    leadingAssets: LeadingAsset[]
    chainIds: ChainId[]
}

export type UsePendingSwapsResult = {
    rows: PendingSwapRow[]
}

const leadingAssetOf = ({ ref, unitName }: SwapTrackedAsset): LeadingAsset => ({
    chainId: ref.chainId,
    asset: { assetId: ref.assetId, unitName: unitName ?? undefined },
})

/**
 * Swaps placed on this device still on their way to `shownScope`, from the
 * tracked orders. Only where History lists no row for them: under All networks
 * or the paying network, the swap's own source row already shows it.
 */
export const usePendingSwaps = (
    shownScope: Nullable<ChainScope>,
): UsePendingSwapsResult => {
    const { t } = useLanguage()
    const accountAddresses = useSwapAccountAddresses(useSelectedAccount())
    const orders = useOpenSwapOrders(accountAddresses, shownScope)

    const rows = useMemo(() => {
        if (!shownScope) return []
        const shownKey = toScopeKey(shownScope)
        return orders
            .filter(order => toScopeKey(order.sourceScope) !== shownKey)
            .map(order => ({
                orderId: order.orderId,
                title: t('transactions.list_item.swap'),
                subtitle: t('transactions.list_item.swap_assets', {
                    from: swapAssetUnit(order.assetIn),
                    to: swapAssetUnit(order.assetOut),
                }),
                leadingAssets: [
                    leadingAssetOf(order.assetIn),
                    leadingAssetOf(order.assetOut),
                ],
                chainIds: [
                    order.sourceScope.chainId,
                    order.destinationScope.chainId,
                ],
            }))
    }, [orders, shownScope, t])

    return { rows }
}
