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

import { useCallback } from 'react'
import { type Decimal } from 'decimal.js'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useSendFundsStore } from '@modules/transactions/hooks'

export type SendFundsDeeplinkPrefill = {
    assetId?: string
    destination?: string
    /**
     * Display-units amount (e.g. ALGOs). Set when the deeplink already
     * carries enough info to convert (microAlgos → ALGOs). Lands on
     * `useSendFundsStore.amount`.
     */
    amount?: Decimal
    /**
     * Raw base-units amount (e.g. micro-USDC). Set for ASSET_TRANSFER
     * deeplinks where the conversion needs the asset's `decimals`, which
     * aren't known until the asset query resolves. InputScreen converts
     * this once `asset` loads.
     */
    amountBaseUnits?: string
    note?: string
}

export type SendFundsDeeplinkHandler = (
    prefill: SendFundsDeeplinkPrefill,
) => void

/**
 * Opens the SendFunds bottom sheet with optional prefill (destination,
 * asset, amount, note). Used by ALGO_TRANSFER, ASSET_TRANSFER and
 * RECEIVER_ACCOUNT_SELECTION deeplinks.
 */
export const useSendFundsDeeplink = (): SendFundsDeeplinkHandler => {
    const { requestByType } = useBottomSheetStore()

    return useCallback(
        ({ assetId, destination, amount, amountBaseUnits, note }) => {
            const sendFundsStore = useSendFundsStore.getState()
            // Reset stale prefill from a previous deeplink so a partial
            // prefill (e.g. address-only) doesn't inherit an old amount.
            sendFundsStore.reset()
            if (destination) sendFundsStore.setDestination(destination)
            if (note) sendFundsStore.setNote(note)
            if (assetId !== undefined) {
                sendFundsStore.setSelectedAssetId(assetId)
                sendFundsStore.setCanSelectAsset(false)
            }
            if (amount) sendFundsStore.setAmount(amount)
            if (amountBaseUnits) {
                sendFundsStore.setPendingAmountBaseUnits(amountBaseUnits)
            }

            // Same modal the in-app Send button opens (see useAccountOverview).
            void requestByType(
                'send-funds',
                { assetId },
                {
                    size: 'modal',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            )
        },
        [requestByType],
    )
}
