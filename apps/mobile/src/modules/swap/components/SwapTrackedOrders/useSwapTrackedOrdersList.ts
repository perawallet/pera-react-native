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
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import {
    isSwapOrderSettled,
    useSwapTrackedOrders,
    useSwapTrackingStore,
    useSwapAccount,
} from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapAccountAddresses } from '../../hooks/useSwapAccountAddresses'
import type { SwapIconAsset } from '../../utils/swapAssetToDisplayable'
import {
    swapAssetUnit,
    swapNetworkName,
    swapPairLabel,
    swapPairLabelWithNetworks,
} from '../../utils/swapPairLabel'
import { swapTrackedIconAsset } from '../../utils/swapTrackedIconAsset'
import { swapTrackingStatusKey } from '../../utils/swapTrackingStatusKey'

export type SwapTrackedOrderRow = {
    orderId: string
    assetIn: SwapIconAsset
    assetOut: SwapIconAsset
    pairLabel: string
    statusText: string
    isSettled: boolean
}

type UseSwapTrackedOrdersListResult = {
    rows: SwapTrackedOrderRow[]
    isVisible: boolean
    handleDismiss: (orderId: string) => void
}

export const useSwapTrackedOrdersList = (): UseSwapTrackedOrdersListResult => {
    const { t } = useLanguage()
    const accountAddresses = useSwapAccountAddresses(useSwapAccount())
    const sourceAddresses = useMemo(
        () => accountAddresses.map(entry => entry.address),
        [accountAddresses],
    )
    const orders = useSwapTrackedOrders(sourceAddresses)
    const handleDismiss = useSwapTrackingStore(state => state.removeOrder)

    const rows = useMemo(() => {
        const now = Date.now()
        return orders.map(order => {
            const fromAsset = swapAssetUnit(order.assetIn)
            const toAsset = swapAssetUnit(order.assetOut)
            const isCrossChain =
                toScopeKey(order.sourceScope) !==
                toScopeKey(order.destinationScope)
            return {
                orderId: order.orderId,
                assetIn: swapTrackedIconAsset(order.assetIn),
                assetOut: swapTrackedIconAsset(order.assetOut),
                pairLabel: isCrossChain
                    ? swapPairLabelWithNetworks(order)
                    : swapPairLabel(order),
                statusText: t(swapTrackingStatusKey(order.status), {
                    fromAsset,
                    toAsset,
                    network: swapNetworkName(order.assetOut),
                }),
                isSettled: isSwapOrderSettled(order, now),
            }
        })
    }, [orders, t])

    return {
        rows,
        isVisible: rows.length > 0,
        handleDismiss,
    }
}
