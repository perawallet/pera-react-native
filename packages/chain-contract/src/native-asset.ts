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

import type { ChainId } from './models/identity'

// A Record so that adding a chain id stops this compiling. Must agree with the
// chain's ChainDescriptor.nativeAsset.decimals.
const NATIVE_ASSET_DECIMALS: Record<ChainId, number> = {
    algorand: 6,
}

/** Base units per display unit of the chain's native asset, as a power of ten. */
export const nativeAssetDecimals = (chainId: ChainId): number =>
    NATIVE_ASSET_DECIMALS[chainId]
