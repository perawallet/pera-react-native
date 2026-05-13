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

import type { Network, Optional } from '@perawallet/wallet-core-shared'

const MODULE_PREFIX = 'swaps'

export const swapQueryKeys = {
    availableAssets: (
        assetInId: number,
        q: Optional<string>,
        network: Network,
    ) =>
        [MODULE_PREFIX, 'available-assets', { assetInId, q, network }] as const,
    history: (address: string, statuses: Optional<string>, network: Network) =>
        [MODULE_PREFIX, 'history', { address, statuses, network }] as const,
    historyInfinite: (
        address: string,
        statuses: Optional<string>,
        network: Network,
    ) =>
        [
            MODULE_PREFIX,
            'history-infinite',
            { address, statuses, network },
        ] as const,
    distinctPairsHistory: (
        address: string,
        statuses: Optional<string>,
        network: Network,
    ) =>
        [
            MODULE_PREFIX,
            'distinct-pairs-history',
            { address, statuses, network },
        ] as const,
    providers: (network: Network) =>
        [MODULE_PREFIX, 'providers', { network }] as const,
    topPairs: (limit: Optional<number>, network: Network) =>
        [MODULE_PREFIX, 'top-pairs', { limit, network }] as const,
}
