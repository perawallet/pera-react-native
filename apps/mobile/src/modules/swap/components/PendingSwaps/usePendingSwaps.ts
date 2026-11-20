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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useOpenSwapOrders } from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapAccountAddresses } from '../../hooks/useSwapAccountAddresses'
import { swapPairLabel } from '../../utils/swapPairLabel'

export type PendingSwapRow = {
    orderId: string
    pairLabel: string
    statusText: string
}

export type UsePendingSwapsResult = {
    rows: PendingSwapRow[]
}

/** Only swaps placed on this device: they come from the tracked orders. */
export const usePendingSwaps = (
    shownScope: Nullable<ChainScope>,
): UsePendingSwapsResult => {
    const { t } = useLanguage()
    const accountAddresses = useSwapAccountAddresses(useSelectedAccount())
    const orders = useOpenSwapOrders(accountAddresses, shownScope)

    const rows = useMemo(
        () =>
            orders.map(order => ({
                orderId: order.orderId,
                pairLabel: swapPairLabel(order),
                statusText: t('swap.tracking.in_progress'),
            })),
        [orders, t],
    )

    return { rows }
}
