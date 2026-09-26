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

import type { RampChainAdapter } from '@perawallet/wallet-core-onramp'
import {
    ALGO_ASSET_ID,
    ALGO_ASSET_NAME,
    isAlgoAssetId,
    isAlgoAssetName,
} from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'

// A numeric id is an on-chain id and wins; the ticker is trusted only when the
// provider gives a code instead. That fallback assumes the provider names its
// own listings honestly, which holds for a brokered provider list and never
// for an on-chain unit name.
const isNativeToken: RampChainAdapter['isNativeToken'] = token =>
    /^\d+$/.test(token.id)
        ? isAlgoAssetId(token.id)
        : isAlgoAssetName(token.id) || isAlgoAssetName(token.symbol)

export const algorandRampAdapter: RampChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    destinationTokenIds: [ALGO_ASSET_NAME, 'USDC_ALGORAND'],
    isNativeToken,
    toAssetId: token => (isNativeToken(token) ? ALGO_ASSET_ID : token.id),
}
