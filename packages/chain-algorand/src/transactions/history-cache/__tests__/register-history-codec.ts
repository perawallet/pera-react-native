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

import { vi } from 'vitest'
import { historyChainAdapters } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'
import { resolveAlgorandAssetFacts } from '../../history/assetFacts'
import { algorandHistoryChainData } from '../chain-data'

// The shared repository finds the codec through the registry; the full
// adapter would pull in signing and the network clients.
export const registerAlgorandHistoryCodec = () => {
    historyChainAdapters.reset()
    historyChainAdapters.register({
        chainId: ALGORAND_CHAIN_ID,
        getTransactionHistory: vi.fn(),
        resolveAssetFacts: resolveAlgorandAssetFacts,
        chainData: algorandHistoryChainData,
    })
}
