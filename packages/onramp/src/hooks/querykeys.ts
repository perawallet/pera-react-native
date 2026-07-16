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

import type { Network, Optional } from '@perawallet/wallet-core-shared'

import type { OnrampStatus } from '../models'

const MODULE_PREFIX = 'onramp'

export const onrampQueryKeys = {
    pairs: (destinationTokenIds: string[], network: Network) =>
        [MODULE_PREFIX, 'pairs', { destinationTokenIds, network }] as const,
    region: (network: Network) =>
        [MODULE_PREFIX, 'region', { network }] as const,
    /** Prefix matching every history query (any device/account/status/network) —
     *  used to invalidate the list after an order changes (e.g. cancelled). */
    historyRoot: () => [MODULE_PREFIX, 'history'] as const,
    history: (
        deviceId: string,
        accountAddress: string,
        status: Optional<OnrampStatus>,
        network: Network,
    ) =>
        [
            MODULE_PREFIX,
            'history',
            { deviceId, accountAddress, status, network },
        ] as const,
}
