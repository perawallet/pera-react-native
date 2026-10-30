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
import type { ChainUi, ChainUiOverride, ChainUiRegistry } from './types'

export const chainUiRegistry: ChainUiRegistry = {
    families: { algorand: algorandChainUi, evm: ethereumChainUi },
    chains: { evm: evmChainUiOverrides },
}

const NO_CHAIN_UI: ChainUi = {}

// The registry is static, so one merged entry per chain keeps it as stable a memo dep as a family's.
const mergedChainUi = new Map<string, ChainUi>()

const layerOverride = (
    familyUi: ChainUi,
    override: ChainUiOverride,
): ChainUi => {
    const slots = Object.fromEntries(
        Object.entries(override).filter(([, slot]) => slot !== undefined),
    )
    return { ...familyUi, ...slots }
}

export const chainUiFor = (family: ChainFamily, chainId?: ChainId): ChainUi => {
    const familyUi = chainUiRegistry.families[family] ?? NO_CHAIN_UI
    if (chainId === undefined) {
        return familyUi
    }
    const override = chainUiRegistry.chains[family]?.[chainId]
    if (!override) {
        return familyUi
    }
    const key = `${family}:${chainId}`
    const cached = mergedChainUi.get(key)
    if (cached) {
        return cached
    }
    const merged = layerOverride(familyUi, override)
    mergedChainUi.set(key, merged)
    return merged
}
