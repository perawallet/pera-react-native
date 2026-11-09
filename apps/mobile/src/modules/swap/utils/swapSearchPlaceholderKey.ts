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
    isEvmChainId,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'

// "Asset ID" is Algorand's word; an EVM token is found by its contract.
export const swapSearchPlaceholderKey = (
    chainIds: readonly ChainId[],
): I18nKey => {
    const evmCount = chainIds.filter(isEvmChainId).length
    if (evmCount === 0)
        return i18nKey('swap.asset_selection.search_placeholder')
    if (evmCount === chainIds.length) {
        return i18nKey('swap.asset_selection.search_placeholder_evm')
    }
    return i18nKey('swap.asset_selection.search_placeholder_all')
}
