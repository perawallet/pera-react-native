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

import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'

/** Names the one token a fungible approval covers; anything else reads as "your assets". */
export const useSpendApprovalTitle = (
    approval: SpendApproval,
    scope: ChainScope,
): string => {
    const { t } = useLanguage()
    const [only] = approval.allowances
    const singleTokenId =
        approval.allowances.length === 1 && !only.nft
            ? only.assetRef.assetId
            : ''
    const { data: asset } = useSingleAssetDetailsQuery(singleTokenId, scope)
    const unitName = singleTokenId ? asset?.unitName : undefined
    const name = approval.knownSpender?.name

    if (name) {
        return unitName
            ? t('signing.spend_approval.permit_title', {
                  spender: name,
                  asset: unitName,
              })
            : t('signing.spend_approval.permit_title_assets', {
                  spender: name,
              })
    }
    return unitName
        ? t('signing.spend_approval.permit_title_unknown', { asset: unitName })
        : t('signing.spend_approval.permit_title_unknown_assets')
}
