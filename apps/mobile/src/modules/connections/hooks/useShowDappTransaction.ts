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
import type { ShowTransaction } from '@perawallet/wallet-core-connections'
import { useWebView } from '@modules/webview'

/**
 * Opens a transaction a dApp asked about on the chain's explorer. The app has
 * no detail view that loads a transaction by hash alone, so a network with no
 * explorer shows nothing.
 */
export const useShowDappTransaction = (): ShowTransaction => {
    const { pushWebView } = useWebView()

    return useCallback(
        ({ scope, txId }) => {
            const url = getChainDescriptor(
                scope.chainId,
            ).explorer.transactionUrl(scope.networkId, txId)
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- chain explorer config origin; the dApp's txId only fills the path
            if (url) pushWebView({ url })
        },
        [pushWebView],
    )
}
