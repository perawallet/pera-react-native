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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

export interface AssetGroupMember {
    scope: ChainScope
    /** The chain's own asset id, as holdings store it. */
    assetId: string
}

/** Per-chain assets the backend curates as one asset, such as one stablecoin on two chains. */
export interface AssetGroup {
    id: string
    name: string
    symbol: string
    logoUrl: Nullable<string>
    members: AssetGroupMember[]
}
