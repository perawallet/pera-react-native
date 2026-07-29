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

import {
    type PeraDisplayableTransaction,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useMemo } from 'react'
import { useWebView } from '@modules/webview/hooks'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { generateUniqueId, type Optional } from '@perawallet/wallet-core-shared'

export const useTransactionFooter = (
    transaction: PeraDisplayableTransaction,
) => {
    const { networkConfig } = useNetwork()
    const { pushWebView } = useWebView()

    // Undefined on a network with no explorer (`custom`'s `explorerUrl` is `''`
    // by design), so the CTA is hidden rather than opening the schemeless
    // relative path the interpolation would otherwise produce.
    const showInExplorer = networkConfig.explorerUrl
        ? () => {
              if (!networkConfig.explorerUrl) return
              pushWebView({
                  url: `${networkConfig.explorerUrl}/tx/${transaction.id}`,
                  id: generateUniqueId(),
              })
          }
        : undefined

    const { data: asset } = useSingleAssetDetailsQuery(
        transaction.assetTransferTransaction?.assetId?.toString() ?? '',
    )

    const assetUrl = useMemo(() => {
        let url: Optional<string> = undefined
        if (transaction.assetConfigTransaction?.params?.url) {
            url = transaction.assetConfigTransaction.params.url
        } else if (asset?.url) {
            url = asset.url
        }

        if (url && !url.startsWith('http')) {
            url = `https://${url}`
        }

        return url
    }, [asset, transaction.assetConfigTransaction?.params?.url])

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
