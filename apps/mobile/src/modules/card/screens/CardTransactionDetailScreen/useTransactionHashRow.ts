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

import { useCallback, useMemo } from 'react'
import { Linking } from 'react-native'
import { getCardTransactionUrl } from '@perawallet/wallet-core-card'
import {
    generateUniqueId,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import { useWebView } from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'
import { useClipboard } from '@hooks/useClipboard'
import { useCardScope } from '../../hooks/useCardScope'

// "ABCDEF...UVWXYZ" — enough of each end to eyeball-match in the explorer.
const HASH_DISPLAY_LENGTH = 12

type UseTransactionHashRowResult = {
    truncatedHash: string
    onCopy: () => void
    /**
     * Undefined when the explorer can't resolve the leg — Baanx also settles
     * from other chains — or the network has no explorer, so the action is
     * hidden instead of opening a guaranteed not-found page.
     */
    onOpenExplorer: (() => void) | undefined
}

export const useTransactionHashRow = (
    txHash: string,
    network: string,
): UseTransactionHashRowResult => {
    const scope = useCardScope()
    const { pushWebView } = useWebView()
    const { copyToClipboard } = useClipboard()

    const explorerUrl = useMemo(
        () => getCardTransactionUrl(txHash, network, scope),
        [txHash, network, scope],
    )

    const onCopy = useCallback(() => {
        trackEvent(CardEvent.TransactionsCopyTx)
        void copyToClipboard(txHash)
    }, [copyToClipboard, txHash])

    const openExplorer = useCallback(() => {
        if (explorerUrl === null) return
        trackEvent(CardEvent.TransactionsViewExplorer)
        if (!routeCapabilities.inAppWebView) {
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- built by the card adapter from the network's explorer config
            void Linking.openURL(explorerUrl)
            return
        }
        pushWebView({ url: explorerUrl, id: generateUniqueId() })
    }, [explorerUrl, pushWebView])

    return {
        truncatedHash: truncateAlgorandAddress(txHash, HASH_DISPLAY_LENGTH),
        onCopy,
        onOpenExplorer: explorerUrl === null ? undefined : openExplorer,
    }
}
