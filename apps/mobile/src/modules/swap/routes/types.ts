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
    AssetRef,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'

export type SwapScreenParams = {
    assetIn?: AssetRef
    assetOut?: AssetRef
    /**
     * The output of a cross-chain swap: one a browser tab resumes, or Swap for
     * {native} from an empty network. Apart from `assetOut` because a
     * deeplink's `assetOut` on another chain must stay ignored.
     */
    receive?: { scope: ChainScope; assetId: string; accountId: string }
    /** Pay-asset display units, for a swap a browser tab resumes from the popup. */
    // lanekeep-ignore-next-line pera/amount-types reason: React Navigation params must be serializable, so the amount travels as a string
    payAmount?: string
}
