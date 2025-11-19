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

import type { Config } from './main'

export const config: Config = {
    mainnetBackendUrl: 'https://mainnet.staging.api.perawallet.app',
    testnetBackendUrl: 'https://testnet.staging.api.perawallet.app',
    mainnetAlgodUrl: 'https://mainnet-api.algonode.cloud',
    testnetAlgodUrl: 'https://testnet-api.algonode.cloud',
    mainnetIndexerUrl: 'http://mainnet-idx.algonode.cloud',
    testnetIndexerUrl: 'http://testnet-idx.algonode.cloud',
    backendAPIKey:
        'development-purposes-only-dc98f2c7-908f-4f74-81ef-9f5464213f99',
    algodApiKey: '',
    indexerApiKey: '',

    discoverBaseUrl: 'https://discover-mobile-staging.perawallet.app/',
    stakingBaseUrl: 'https://staking-mobile-staging.perawallet.app/',

    notificationRefreshTime: 30 * 1000,
    remoteConfigRefreshTime: 60 * 60 * 1000,

    reactQueryDefaultGCTime: 60 * 60 * 1000,
    reactQueryDefaultStaleTime: 30 * 1000,
    reactQueryPersistenceAge: 1000 * 60 * 60 * 24,

    debugEnabled: true,
    profilingEnabled: false,
    pollingEnabled: false, //Disable polling to avoid spam in the console
}
