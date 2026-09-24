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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { usePollingStore } from '../polling'
import type { SyncStorePorts } from '../models'

export const createSyncStorePorts = (): SyncStorePorts => ({
    getAccountAddresses: () =>
        useAccountsStore.getState().accounts.map(a => a.address),
    getActiveNetwork: () => useNetworkStore.getState().network,
    // The persisted map can be partial, and an absent key must read as
    // never-synced (null), not as undefined — which `!== null` would treat
    // as already synced and skip the force-sync.
    getLastRefreshedRound: network =>
        usePollingStore.getState().lastRefreshedRound[network] ?? null,
    setLastRefreshedRound: (network, round) =>
        usePollingStore.getState().setLastRefreshedRound(network, round),
})
