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
import type { Decimal } from 'decimal.js'
import type { MinimalAsset } from '@perawallet/wallet-core-assets'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'

export type UseAssetHoldingsResult = {
    canCopyAmount: boolean
    copyAmountHint: string
    handleCopyAmount: () => void
}

/**
 * The balance shows a rounded figure (6 dp at most), so a long-press copies the
 * full-precision amount and names it in the toast. Privacy mode disables it:
 * the copy would reveal the hidden balance.
 */
export const useAssetHoldings = (
    amount: Decimal,
    asset: Pick<MinimalAsset, 'unitName'>,
): UseAssetHoldingsResult => {
    const { copyToClipboard } = useClipboard()
    const { t } = useLanguage()
    const { privacyMode } = useSettings()

    const handleCopyAmount = useCallback(() => {
        if (privacyMode) return
        const fullAmount = amount.toFixed()
        const label = `${fullAmount} ${asset.unitName ?? ''}`.trim()
        void copyToClipboard(fullAmount, { body: label })
    }, [amount, asset.unitName, copyToClipboard, privacyMode])

    return {
        canCopyAmount: !privacyMode,
        copyAmountHint: t('asset_details.copy_full_amount_hint'),
        handleCopyAmount,
    }
}
