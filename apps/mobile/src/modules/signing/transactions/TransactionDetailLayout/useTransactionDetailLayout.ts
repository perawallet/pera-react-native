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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'

export type UseTransactionDetailLayoutResult = {
    /** Names the transaction's own chain's explorer, never one shared across chains. */
    explorerLabel: string
    /** Unset without an id to open, or on a network with no explorer. */
    handleOpenExplorer: Optional<() => void>
}

export const useTransactionDetailLayout = (
    scope: ChainScope,
    transactionId: Optional<string>,
): UseTransactionDetailLayoutResult => {
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { explorer } = getChainDescriptor(scope.chainId)
    // Read per render, never memoised on `scope`: a saved custom node keeps the same scope.
    const url = transactionId
        ? explorer.transactionUrl(scope.networkId, transactionId)
        : undefined

    const handleOpenExplorer = useCallback(() => {
        // oxlint-disable-next-line pera/no-unvalidated-open-url -- chain explorer config origin; the transaction id only fills the path
        if (url) pushWebView({ url })
    }, [pushWebView, url])

    return {
        explorerLabel: t('transactions.common.view_in_explorer', {
            explorer: explorer.name,
        }),
        handleOpenExplorer: url ? handleOpenExplorer : undefined,
    }
}
