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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useKeptTokensStore } from '@perawallet/wallet-core-accounts'
import type { EvmChain } from '../chains/types'
import { fromCaip19 } from '../blockchain/utils/caip19'
import type { EvmHistoryItem } from './api/schema'

const idOf = (caip19: string, scope: ChainScope, chain: EvmChain): string[] => {
    try {
        const id = fromCaip19(caip19, scope, chain)
        return id === chain.nativeAsset.assetId ? [] : [id]
    } catch {
        return []
    }
}

/**
 * A token the account sent or swapped in a transaction it signed is one the
 * user chose, so Pera's suspicious flag never takes it out of the list.
 */
export const keepTokensTheAccountMoved = (
    items: readonly EvmHistoryItem[],
    address: string,
    scope: ChainScope,
    chain: EvmChain,
): void => {
    const assetIds = items
        .filter(
            item =>
                item.status === 'success' &&
                item.from?.toLowerCase() === address.toLowerCase(),
        )
        .flatMap(item =>
            item.balance_impacts.flatMap(({ asset_id }) =>
                idOf(asset_id, scope, chain),
            ),
        )
    if (assetIds.length === 0) return
    useKeptTokensStore.getState().keepTokens({ address, scope, assetIds })
}
