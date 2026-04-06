/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create } from 'zustand'
import type { SwapsState } from '../models'

// TODO: Replace with ALGO_ASSET_ID and KNOWN_ASSET_IDS.USDC from @perawallet/wallet-core-assets
// once the assets barrel (which re-exports hooks) no longer causes Metro evaluation order issues
const initialState = {
    fromAsset: '0', // ALGO
    toAsset: '31566704', // USDC mainnet
}

export const useSwapsStore = create<SwapsState>()(set => ({
    ...initialState,
    setFromAsset: (fromAsset: string) => set({ fromAsset }),
    setToAsset: (toAsset: string) => set({ toAsset }),
    resetState: () => set(initialState),
}))
