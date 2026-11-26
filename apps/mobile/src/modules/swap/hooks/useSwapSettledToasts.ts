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

import { useEffect } from 'react'
import {
    useSwapTrackingStore,
    type SwapStatus,
} from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { swapAssetUnit, swapPairLabelWithChains } from '../utils/swapPairLabel'
import { swapTrackingStatusKey } from '../utils/swapTrackingStatusKey'

const TOAST_TYPE: Partial<Record<SwapStatus, 'success' | 'error' | 'warning'>> =
    {
        completed: 'success',
        failed: 'error',
        refunded: 'warning',
        expired: 'warning',
        cancelled: 'warning',
    }

/**
 * Toasts a tracked swap once the tracker sees it settle. Only a status change
 * toasts, so orders restored from storage at launch stay quiet.
 */
export const useSwapSettledToasts = (): void => {
    const { t } = useLanguage()
    const { showToast } = useToast()

    useEffect(
        () =>
            useSwapTrackingStore.subscribe((state, previous) => {
                Object.values(state.orders).forEach(order => {
                    const before = previous.orders[order.orderId]
                    const type = TOAST_TYPE[order.status]
                    if (!type || !before || before.status === order.status) {
                        return
                    }
                    showToast({
                        type,
                        title: swapPairLabelWithChains(order),
                        body: t(swapTrackingStatusKey(order.status), {
                            fromAsset: swapAssetUnit(order.assetIn),
                            toAsset: swapAssetUnit(order.assetOut),
                        }),
                    })
                })
            }),
        [showToast, t],
    )
}
