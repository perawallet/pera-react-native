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
    isSwapOrderSettled,
    useSwapTrackedOrders,
    useSwapTrackingStore,
    type SwapTrackedAsset,
} from '@perawallet/wallet-core-swaps'
import { useIsCrossChainSwapEnabled } from '@hooks/useIsCrossChainSwapEnabled'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapAccountAddresses } from '../../hooks/useSwapAccountAddresses'
import { swapTrackingStatusKey } from '../../utils/swapTrackingStatusKey'

export type SwapTrackedOrderRow = {
    orderId: string
    pairLabel: string
    statusText: string
    isSettled: boolean
}

type UseSwapTrackedOrdersListResult = {
    rows: SwapTrackedOrderRow[]
    isVisible: boolean
    handleDismiss: (orderId: string) => void
}

const unitOf = (asset: SwapTrackedAsset): string =>
    asset.unitName ?? asset.ref.assetId

export const useSwapTrackedOrdersList = (): UseSwapTrackedOrdersListResult => {
    const { t } = useLanguage()
    const isEnabled = useIsCrossChainSwapEnabled()
    const accountAddresses = useSwapAccountAddresses(useSelectedAccount())
    const sourceAddresses = useMemo(
        () => accountAddresses.map(entry => entry.address),
        [accountAddresses],
    )
    const orders = useSwapTrackedOrders(sourceAddresses)
    const handleDismiss = useSwapTrackingStore(state => state.removeOrder)

    const rows = useMemo(() => {
        const now = Date.now()
        return orders.map(order => {
            const fromAsset = unitOf(order.assetIn)
            const toAsset = unitOf(order.assetOut)
            return {
                orderId: order.orderId,
                pairLabel: `${fromAsset} → ${toAsset}`,
                statusText: t(swapTrackingStatusKey(order.status), {
                    fromAsset,
                    toAsset,
                }),
                isSettled: isSwapOrderSettled(order, now),
            }
        })
    }, [orders, t])

    return {
        rows,
        isVisible: isEnabled && rows.length > 0,
        handleDismiss,
    }
}
