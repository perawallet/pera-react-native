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
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { chainUiFor } from '@modules/chain-ui'

/** The family's own copy when every chain shown agrees on it, else copy that names every ID format. */
export const swapAssetSearchPlaceholderKey = (
    chainIds: readonly ChainId[],
): I18nKey => {
    const mixedKey = i18nKey('swap.asset_selection.search_placeholder_all')
    const keys = new Set(
        chainIds.map(
            chainId =>
                chainUiFor(getChainDescriptor(chainId).family)
                    .swapAssetSearchPlaceholder ?? mixedKey,
        ),
    )
    const [only] = keys
    return keys.size === 1 && only ? only : mixedKey
}
