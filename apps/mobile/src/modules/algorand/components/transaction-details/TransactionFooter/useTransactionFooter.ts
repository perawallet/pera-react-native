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

import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { toValidatedBrowserUrl, useWebView } from '@modules/webview'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { generateUniqueId } from '@perawallet/wallet-core-shared'

export const useTransactionFooter = (transaction: AlgorandTransactionView) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    // Read per render, never memoised on `scope`: a saved custom node keeps the same scope.
    const { explorerUrl } = getAlgorandChainConfig(scope)
    const { pushWebView } = useWebView()

    // Undefined on a network with no explorer (`custom`'s `explorerUrl` is `''`
    // by design), so the CTA is hidden rather than opening the schemeless
    // relative path the interpolation would otherwise produce.
    const showInExplorer = explorerUrl
        ? () => {
              if (!explorerUrl) return
              // oxlint-disable-next-line pera/no-unvalidated-open-url -- network explorerUrl config plus the transaction id
              pushWebView({
                  url: `${explorerUrl}/tx/${transaction.id}`,
                  id: generateUniqueId(),
              })
          }
        : undefined

    const { data: asset } = useSingleAssetDetailsQuery(
        transaction.assetTransferTransaction?.assetId?.toString() ?? '',
        scope,
    )

    const assetUrl = toValidatedBrowserUrl(
        transaction.assetConfigTransaction?.params?.url || asset?.url,
    )

    const showAssetUrl = () => {
        if (!assetUrl) {
            return
        }
        pushWebView({
            url: assetUrl,
            id: generateUniqueId(),
        })
    }

    return {
        showInExplorer,
        assetUrl,
        showAssetUrl,
    }
}
