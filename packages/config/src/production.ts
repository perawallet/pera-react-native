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

import { type Config } from './main'
import {
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE,
    ONE_SECOND,
    THIRTY_SECONDS,
} from './constants'

export const productionConfig: Config = {
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

    mainnetExplorerUrl: 'https://explorer.perawallet.app',
    testnetExplorerUrl: 'https://testnet.explorer.perawallet.app',

    discoverBaseUrl: 'https://discover-mobile.perawallet.app/',
    stakingBaseUrl: 'https://staking-mobile.perawallet.app/',
    onrampBaseUrl: 'https://onramp-mobile.perawallet.app/',
    supportBaseUrl: 'https://perawallet.app/', //TODO: add support url
    termsOfServiceUrl: 'https://perawallet.app/', //TODO: add terms of service url
    privacyPolicyUrl: 'https://perawallet.app/', //TODO: add privacy policy url

    notificationRefreshTime: THIRTY_SECONDS,
    remoteConfigRefreshTime: ONE_HOUR,

    reactQueryDefaultGCTime: ONE_HOUR,
    reactQueryDefaultStaleTime: ONE_MINUTE,
    reactQueryShortLivedGCTime: 60 * ONE_DAY,
    reactQueryShortLivedStaleTime: 30 * ONE_SECOND,
    reactQueryPersistenceAge: 60 * ONE_DAY,

    debugEnabled: false,
    profilingEnabled: false,
    pollingEnabled: true,
}
