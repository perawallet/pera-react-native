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

import { deeplinkAdapters } from '@perawallet/wallet-core-deeplinks'
import { algorandDeeplinkAdapter } from '@packages/chain-algorand/src/deeplinks/adapter'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import { createEvmDeeplinkAdapter } from '@packages/chain-ethereum/src/deeplinks/adapter'

const ethereumDeeplinkAdapter = createEvmDeeplinkAdapter(evmChainOf('ethereum'))

/**
 * Registers the real chain adapters, from source, so a spec parses links the
 * way the app does. Kept apart from `chain-fixtures` so specs that import those
 * don't load the adapters. Callers reset `deeplinkAdapters` afterwards.
 */
export const registerDeeplinkAdapters = (): void => {
    for (const adapter of [algorandDeeplinkAdapter, ethereumDeeplinkAdapter]) {
        if (!deeplinkAdapters.has(adapter.chainId)) {
            deeplinkAdapters.register(adapter)
        }
    }
}
