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

import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAssetListViewStore } from './useAssetListViewStore'

/**
 * The source the network chip narrows to; null on All. Derived, never written
 * back: an account without the stored chain shows All, and the next account
 * that has it shows it again.
 */
export const useSelectedNetworkSource = (
    sources: readonly AccountHoldingSource[],
): Nullable<AccountHoldingSource> => {
    const storedChainId = useAssetListViewStore(state => state.selectedChainId)
    return (
        (storedChainId !== null &&
            sources.find(source => source.scope.chainId === storedChainId)) ||
        null
    )
}
