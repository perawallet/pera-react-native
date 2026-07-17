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

import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { useAccountsStore } from './store'

// Rekeys are per-network on-chain; the `rekeyAddress` mirror every consumer
// reads must follow the active network immediately on switch — not after the
// first sync tick lands (badges and signer routing would be wrong for
// seconds otherwise). Lives outside store.ts so the store module itself has
// no blockchain dependency; loaded via the package barrel, which already
// pulls the network store in through account-discovery.
useNetworkStore.subscribe((state, prev) => {
    if (state.network !== prev.network) {
        useAccountsStore.getState().applyNetworkRekeyState(state.network)
    }
})
