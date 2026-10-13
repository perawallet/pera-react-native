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

import type { Extension } from '@algorandfoundation/wallet-provider'
import {
    createChainRegistry,
    type ChainRegistry,
} from '@perawallet/wallet-core-chain-contract'

export interface ChainRegistryExtension {
    chains: ChainRegistry
}

// Starts empty: each composition root registers the chains it ships, so the
// provider imports no chain package.
export const WithChainRegistry: Extension<ChainRegistryExtension> = (
    provider: Record<string, unknown>,
) => {
    const chains = createChainRegistry()
    provider.chains = chains
    return { chains }
}
