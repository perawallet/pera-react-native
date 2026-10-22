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
import type { AccountHoldingSnapshot } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { fetchNftHoldings } from '../assets/api/endpoints'
import { toNftHolding } from '../assets/api/transformers'
import type { EvmChain } from '../chains/types'

export type NftHoldingsRead = {
    holdings: AccountHoldingSnapshot[]
    /** Metadata for every holding, to persist before the holdings point at it. */
    assets: PeraAsset[]
}

/** Rejects with the fetch error: a partial list must never replace the stored one. */
export const readNftHoldings = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
): Promise<NftHoldingsRead> => {
    const items = await fetchNftHoldings(scope, chain, address)
    const held = items.flatMap(item => toNftHolding(item, scope, chain) ?? [])
    return {
        holdings: held.map(({ asset, amount }) => ({
            assetId: asset.assetId,
            amount,
        })),
        assets: held.map(({ asset }) => asset),
    }
}
