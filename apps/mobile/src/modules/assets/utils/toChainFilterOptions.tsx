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

const CHAIN_CHIP_ICON_SIZE = 16

type ChainFilterOptionsParams = {
    /** Leads with an All chip (value null) when given. */
    allLabel?: string
    /** Each chip's testID is `${prefix}_all` or `${prefix}_${chainId}`. */
    testIDPrefix: string
}

/** Network chips with chain icons; empty for fewer than two chains, as there's nothing to pick. */
export const toChainFilterOptions = (
    chainIds: readonly ChainId[],
    { allLabel, testIDPrefix }: ChainFilterOptionsParams,
): FilterOption<Nullable<ChainId>>[] => {
    if (chainIds.length < 2) return []
    const chainOptions = chainIds.map(chainId => ({
        value: chainId,
        label: chainDisplayNameOf(chainId) ?? chainId,
        icon: (
            <ChainIcon
                chainId={chainId}
                size={CHAIN_CHIP_ICON_SIZE}
            />
        ),
        testID: `${testIDPrefix}_${chainId}`,
    }))
    return allLabel === undefined
        ? chainOptions
        : [
              { value: null, label: allLabel, testID: `${testIDPrefix}_all` },
              ...chainOptions,
          ]
}
