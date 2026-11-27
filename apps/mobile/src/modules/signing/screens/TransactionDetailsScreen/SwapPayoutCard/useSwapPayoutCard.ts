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
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SwapPayoutRef } from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { openExplorerUrl } from '@modules/webview'

export type UseSwapPayoutCardResult = {
    /** False once the payout is listed but its network has no explorer, so there's nothing to show. */
    isShown: boolean
    label: string
    isPending: boolean
    /** Unset while the payout is pending. */
    handleOpen: Optional<() => void>
}

export const useSwapPayoutCard = (
    payout: SwapPayoutRef,
): UseSwapPayoutCardResult => {
    const { t } = useLanguage()
    const { displayName, explorer } = getChainDescriptor(payout.scope.chainId)
    const url = payout.transactionId
        ? explorer.transactionUrl(payout.scope.networkId, payout.transactionId)
        : undefined
    const isPending = !payout.transactionId

    const handleOpen = useCallback(() => {
        if (url) openExplorerUrl(url)
    }, [url])

    return {
        isShown: isPending || !!url,
        label: isPending
            ? t('transactions.common.swap_payout_on', { chain: displayName })
            : t('transactions.common.view_swap_payout_in', {
                  explorer: explorer.name,
              }),
        isPending,
        handleOpen: url ? handleOpen : undefined,
    }
}
