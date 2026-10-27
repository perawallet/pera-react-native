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
    registerChainSetup,
    type ChainRegistry,
} from '@perawallet/wallet-core-chain-contract'
import { evmChainModules } from '@perawallet/wallet-core-chain-ethereum/module'

import { createEvmnetChainContext, installedKms } from './context'
import { EVMNET, EVMNET_CHAINS, type EvmnetChain } from './evmnet'

/**
 * Registers the six chains as the app's bootstrap does, on testnet scopes
 * pointing at evmnet, so registry lookups (planners, reviewers, codecs)
 * resolve to the real EVM adapters.
 */
export const registerEvmnetChains = (chains: ChainRegistry): void =>
    registerChainSetup(
        EVMNET_CHAINS.map(chainId => ({
            chainId,
            enabled: true,
            module: evmChainModules[chainId],
            endpoints: { [EVMNET[chainId].networkId]: EVMNET[chainId].rpcUrl },
        })),
        chains,
        entry =>
            createEvmnetChainContext(
                entry.chainId as EvmnetChain,
                installedKms,
            ),
    )
