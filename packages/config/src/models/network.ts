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

export const Networks = {
    testnet: 'testnet',
    mainnet: 'mainnet',
    betanet: 'betanet',
    /**
     * A single runtime-configurable slot for any node the developer points at —
     * a LocalNet, an fnet instance, a private node. Deliberately NOT a named
     * network: fnet is a *sequence* (fnet1, fnet2, …) and LocalNet's ports vary,
     * so neither has a stable genesis hash or endpoint to bake. Its chain config
     * lives in the custom-network store, not in `config`.
     */
    custom: 'custom',
} as const

export type Network = (typeof Networks)[keyof typeof Networks]
