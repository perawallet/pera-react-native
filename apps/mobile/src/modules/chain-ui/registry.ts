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

import type {
    ChainFamily,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { algorandChainUi } from '@modules/algorand/chain-ui'
import {
    ethereumChainUi,
    evmChainUiOverrides,
} from '@modules/ethereum/chain-ui'
import type { ChainUi, ChainUiRegistry } from './types'

export const chainUiRegistry: ChainUiRegistry = {
    families: { algorand: algorandChainUi, evm: ethereumChainUi },
    chains: { evm: evmChainUiOverrides },
}

const NO_CHAIN_UI: ChainUi = {}

export const chainUiFor = (family: ChainFamily, chainId?: ChainId): ChainUi => {
    const familyUi = chainUiRegistry.families[family] ?? NO_CHAIN_UI
    const override =
        chainId === undefined
            ? undefined
            : chainUiRegistry.chains[family]?.[chainId]
    return override ? { ...familyUi, ...override } : familyUi
}
