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
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { spendApprovalTitleOf } from './spendApprovalTitleOf'

/**
 * Names the one token a fungible approval covers; anything else reads as "your
 * assets". Undefined without an approval, so a caller can fall back to its own title.
 */
export const useSpendApprovalTitle = (
    approval: Optional<SpendApproval>,
    scope: ChainScope,
): Optional<string> => {
    const { t } = useLanguage()
    const allowances = approval?.allowances ?? []
    const [only] = allowances
    const singleTokenId =
        allowances.length === 1 && !only.nft ? only.assetRef.assetId : ''
    const { data: asset } = useSingleAssetDetailsQuery(singleTokenId, scope)
    if (!approval) return undefined
    const unitName = singleTokenId ? asset?.unitName : undefined
    return spendApprovalTitleOf(t, {
        spenderName: approval.knownSpender?.name,
        unitName,
    })
}
