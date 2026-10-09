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

import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'
import type { NodeBackendsAdapter } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'

// getAlgorandChainConfig folds in a saved custom node, which reaches the
// clients once algorandClient's subscription resets them.
export const algorandNodeBackends: NodeBackendsAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    backendsFor: scope => {
        const { algodUrl, algodToken, indexerUrl, indexerToken } =
            getAlgorandChainConfig(scope)
        return {
            algod: {
                url: algodUrl,
                tokenHeader: 'X-Algo-API-Token',
                token: algodToken,
            },
            indexer: {
                url: indexerUrl,
                tokenHeader: 'X-Indexer-API-Token',
                token: indexerToken,
            },
        }
    },
}
