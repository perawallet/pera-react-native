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

import type { ObservedChainState } from '@perawallet/wallet-core-accounts'
import type { AccountChainState } from '@perawallet/wallet-core-chain-contract'
import { algosToMicroAlgos } from '@perawallet/wallet-core-shared'

const STATUSES = ['Offline', 'Online', 'NotParticipating'] as const

export const toAlgorandChainState = (
    observed: ObservedChainState,
): AccountChainState => ({
    family: 'algorand',
    minBalance: algosToMicroAlgos(observed.minBalance ?? 0),
    status: STATUSES.find(status => status === observed.status) ?? 'Offline',
    totalAssetsOptedIn: observed.totalAssetsOptedIn ?? 0,
    totalCreatedAssets: observed.totalCreatedAssets ?? 0,
    totalAppsOptedIn: observed.totalAppsOptedIn ?? 0,
    ...(observed.authAddress ? { authAddress: observed.authAddress } : {}),
})
