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
    ChainModule,
    EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import { evmCapabilityDefaultsOf } from './capability-defaults'
import { EVM_CHAINS } from './chains/table'
import type { EvmChain } from './chains/types'
import { createEvmChainRegistration } from './register'

export const createEvmChainModule = (chain: EvmChain): ChainModule => ({
    descriptor: chain.descriptor,
    capabilityDefaults: evmCapabilityDefaultsOf(chain.row),
    capabilityRestrictions: chain.row.restrictions,
    register: createEvmChainRegistration(chain),
})

export const evmChainModules: Readonly<Record<EvmChainId, ChainModule>> =
    Object.fromEntries(
        EVM_CHAINS.map(chain => [chain.row.id, createEvmChainModule(chain)]),
    ) as Record<EvmChainId, ChainModule>

export const ethereumModule: ChainModule = evmChainModules.ethereum
