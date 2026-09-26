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

import { registerAlgorandChain } from '@perawallet/wallet-core-chain-algorand'

// The app picks which chains ship: generic packages only define the adapter
// registries and never import a chain package.
export const registerChainAdapters = (): void => {
    registerAlgorandChain()
}
