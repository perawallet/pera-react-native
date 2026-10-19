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

import type { ChainRegistry } from '@perawallet/wallet-core-chain-contract'
import type { AssetGroup } from '../../models'
import type { AssetGroupsResponse } from './schema'

/** Members on a network this build doesn't register are dropped, and so is a group left with none. */
export const toAssetGroups = (
    response: AssetGroupsResponse,
    chains: ChainRegistry,
): AssetGroup[] =>
    response.results.flatMap(group => {
        const members = group.members.flatMap(member => {
            const resolved = chains.byCaip2(member.chain_id)
            return resolved
                ? [
                      {
                          scope: {
                              chainId: resolved.chainId,
                              networkId: resolved.network.id,
                          },
                          assetId: member.asset_id,
                      },
                  ]
                : []
        })
        return members.length > 0
            ? [
                  {
                      id: group.id,
                      name: group.name,
                      symbol: group.symbol,
                      logoUrl: group.logo_url,
                      members,
                  },
              ]
            : []
    })
