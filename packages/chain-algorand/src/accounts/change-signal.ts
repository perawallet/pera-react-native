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

import type { AccountChangeSignal } from '@perawallet/wallet-core-accounts'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import {
    queryClient,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

type ShouldRefreshResponse = { refresh: boolean; round: number }

/**
 * Whether any of `addresses` changed on `network` after round `cursor`, plus
 * the next cursor. A null cursor always reports a change; rejections propagate
 * so the sync loop can read the HTTP status for its back-off.
 */
export const fetchAlgorandChangeSignal = async (
    addresses: string[],
    network: Network,
    cursor: Nullable<number>,
): Promise<AccountChangeSignal> => {
    // No Pera backend to ask: read every pass. The checkpoint comes from the
    // account reads' observed round, so the cursor stays put.
    if (!isPeraBackedNetwork(network)) {
        return { changed: true, cursor: cursor ?? 0 }
    }

    const { data } = await queryClient<ShouldRefreshResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/v1/accounts/should-refresh/',
        data: {
            account_addresses: addresses,
            last_refreshed_round: cursor,
        },
    })

    return { changed: cursor === null || data.refresh, cursor: data.round }
}
