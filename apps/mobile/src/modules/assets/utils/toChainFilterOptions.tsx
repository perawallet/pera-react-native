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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { ChainIcon } from '@modules/chain-ui/icon'

type ChainFilterOptionsParams = {
    /** Leads with an All chip (value null) when given. */
    allLabel?: string
    /** Each chip's testID is `${prefix}_all` or `${prefix}_${chainId}`. */
    testIDPrefix: string
    /** Draws each chain chip with its chain icon. */
    withIcons?: boolean
}

/** Network chips; empty for fewer than two chains, as there's nothing to pick. */
export const toChainFilterOptions = (
    chainIds: readonly ChainId[],
    { allLabel, testIDPrefix, withIcons = false }: ChainFilterOptionsParams,
): FilterOption<Nullable<ChainId>>[] => {
    if (chainIds.length < 2) return []
    const chainOptions = chainIds.map(chainId => ({
        value: chainId,
        label: chainDisplayNameOf(chainId) ?? chainId,
        testID: `${testIDPrefix}_${chainId}`,
        renderIcon: withIcons
            ? (size: number) => (
                  <ChainIcon
                      chainId={chainId}
                      size={size}
                  />
              )
            : undefined,
    }))
    return allLabel === undefined
        ? chainOptions
        : [
              { value: null, label: allLabel, testID: `${testIDPrefix}_all` },
              ...chainOptions,
          ]
}
