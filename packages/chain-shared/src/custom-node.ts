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
    createChainAdapterRegistry,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { CustomNetworkConfig } from '@perawallet/wallet-core-config'
import type { Optional } from '@perawallet/wallet-core-shared'

export type CustomNodeGenesis = { genesisHash: string; genesisId: string }

/** How the app reads, saves and identifies a chain's user-supplied node. */
export interface CustomNodeAdapter {
    readonly chainId: ChainId
    /** The saved node, `undefined` while unconfigured. */
    read(): Optional<CustomNetworkConfig>
    save(config: CustomNetworkConfig): void
    /** Rejects when the node is unreachable or names no genesis hash. */
    fetchGenesis(nodeUrl: string, token?: string): Promise<CustomNodeGenesis>
}

export const customNodeAdapters =
    createChainAdapterRegistry<CustomNodeAdapter>('custom node')
