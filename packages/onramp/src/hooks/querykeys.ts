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

const MODULE_PREFIX = 'onramp'

export const onrampQueryKeys = {
    destinations: (scope: Nullable<ChainScope>) =>
        [MODULE_PREFIX, 'destinations', { scope }] as const,
    sources: (destinationId: Nullable<string>, scope: Nullable<ChainScope>) =>
        [MODULE_PREFIX, 'sources', { destinationId, scope }] as const,
    region: (scope: Nullable<ChainScope>) =>
        [MODULE_PREFIX, 'region', { scope }] as const,
    /** Prefix matching every history query (any device/account/scope) —
     *  used to invalidate the list after an order changes (e.g. cancelled). */
    historyRoot: () => [MODULE_PREFIX, 'history'] as const,
    history: (
        deviceId: string,
        accountAddress: string,
        scope: Nullable<ChainScope>,
    ) =>
        [
            MODULE_PREFIX,
            'history',
            { deviceId, accountAddress, scope },
        ] as const,
}
