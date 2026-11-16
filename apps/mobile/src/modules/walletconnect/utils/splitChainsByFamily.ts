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
    isEvmChainId,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { uniqueChainIds } from './uniqueChainIds'

export type ChainsByFamily = { evm: ChainId[]; other: ChainId[] }

// EVM dApps only ever use the first address, so EVM chains take a single
// account while every other family keeps multi-select.
export const splitChainsByFamily = (
    chainIds: readonly ChainId[],
): ChainsByFamily => {
    const unique = uniqueChainIds(chainIds)
    return {
        evm: unique.filter(chainId => isEvmChainId(chainId)),
        other: unique.filter(chainId => !isEvmChainId(chainId)),
    }
}
