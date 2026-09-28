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
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useToast } from '@hooks/useToast'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'

export type AssetOptInDeeplinkParams = {
    assetId: string
    /**
     * Sender carried by the deep link. When present it's used directly; when
     * absent the user is prompted to pick which account opts in.
     */
    address?: string
}

export type AssetOptInDeeplinkHandler = (
    params: AssetOptInDeeplinkParams,
) => Promise<void>

const SHEET_OPTIONS = {
    // PWSheetLayout only scrolls when it owns the container: needs
    // autoCreateContainer:false + bounded auto size.
    size: 'auto',
    enablePanDownToClose: true,
    autoCreateContainer: false,
} as const

/**
 * Asset opt-in started from a deep link / QR. Unlike the in-app "add asset"
 * flow, a bare link carries no account, so:
 *
 *   1. Resolve the sender — use the link's address if it carried one, else
 *      prompt the user to pick a signable account.
 *   2. Show the opt-in confirmation sheet (asset + fee) and wait for approval.
 *   3. Run the opt-in mutation, surfacing its outcome as a toast. The mutation
 *      itself checks on-chain opt-in status and balance, so an already-opted-in
 *      account gets a readable error instead of a no-op.
 */
export const useAssetOptInDeeplink = (): AssetOptInDeeplinkHandler => {
    const { requestByType } = useBottomSheetStore()
    const { optIn } = useAssetOptInMutation()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const { t } = useLanguage()

    return useCallback(
        async ({ assetId, address }) => {
            // 1. Resolve the sender. A link without an address must prompt.
            let sender = address
            if (!sender) {
                const selected = await requestByType<
                    'asset-opt-in-account-selection',
                    string
                >('asset-opt-in-account-selection', {}, SHEET_OPTIONS)
                // Dismissed without picking — abort silently.
                if (!selected) return
                sender = selected
            }

            // 2. Confirm the opt-in (shows the asset and fee being signed).
            const confirmation = await requestByType<'asset-opt-in', 'confirm'>(
                'asset-opt-in',
                { assetId, accountAddress: sender },
                SHEET_OPTIONS,
            )
            if (confirmation !== 'confirm') return

            // 3. Execute. The mutation throws AlreadyOptedInError /
            //    InsufficientBalanceForOptInError, which showError renders as a
            //    readable message.
            try {
                await optIn({ sender, assetId: BigInt(assetId) })
                showToast({
                    title: t('add_asset.opt_in.success_title'),
                    body: t('add_asset.opt_in.success_body_generic'),
                    type: 'success',
                })
            } catch (error) {
                if (error instanceof UserRejectedSigningError) return
                showError(error, t('add_asset.opt_in.failed_title'))
            }
        },
        [requestByType, optIn, showToast, showError, t],
    )
}
