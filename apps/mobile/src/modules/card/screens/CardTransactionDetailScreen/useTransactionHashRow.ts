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
import { Linking } from 'react-native'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    generateUniqueId,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview/hooks'
import { routeCapabilities } from '@routes/capabilities'
import { useClipboard } from '@hooks/useClipboard'

// "ABCDEF...UVWXYZ" — enough of each end to eyeball-match in the explorer.
const HASH_DISPLAY_LENGTH = 12

type UseTransactionHashRowResult = {
    truncatedHash: string
    onCopy: () => void
    /**
     * Undefined for non-Algorand funding legs (Baanx also settles from EVM
     * networks, e.g. "linea" with 0x hashes) — the Pera explorer can only
     * resolve Algorand transactions, so the action is hidden instead of
     * opening a guaranteed not-found page.
     */
    onOpenExplorer: (() => void) | undefined
}

export const useTransactionHashRow = (
    txHash: string,
    network: string,
): UseTransactionHashRowResult => {
    const { networkConfig } = useNetwork()
    const { pushWebView } = useWebView()
    const { copyToClipboard } = useClipboard()

    const isAlgorand = network.trim().toLowerCase() === 'algorand'

    const onCopy = useCallback(() => {
        void copyToClipboard(txHash)
    }, [copyToClipboard, txHash])

    const openExplorer = useCallback(() => {
        const url = `${networkConfig.explorerUrl}/tx/${txHash}`
        if (!routeCapabilities.inAppWebView) {
            void Linking.openURL(url)
            return
        }
        pushWebView({ url, id: generateUniqueId() })
    }, [networkConfig.explorerUrl, pushWebView, txHash])

    return {
        truncatedHash: truncateAlgorandAddress(txHash, HASH_DISPLAY_LENGTH),
        onCopy,
        onOpenExplorer: isAlgorand ? openExplorer : undefined,
    }
}
