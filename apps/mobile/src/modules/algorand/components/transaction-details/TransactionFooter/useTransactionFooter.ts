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
import { toValidatedBrowserUrl, useWebView } from '@modules/webview'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'

export const useTransactionFooter = (transaction: AlgorandTransactionView) => {
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const { pushWebView } = useWebView()

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

    // Mirrors the raw transaction button, which shows only before a transaction is signed.
    const hasActions =
        (!!transaction.rawTransaction && !transaction.id) || !!assetUrl

    return {
        assetUrl,
        showAssetUrl,
        hasActions,
    }
}
