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

/**
 * Production configuration with safe defaults for open source builds.
 *
 * For production deployments, override these values at build time using
 * environment variables (see env-loader.ts for details).
 *
 * OSS-Safe Defaults:
 * - Algorand nodes: Public AlgoNode infrastructure
 * - Backend URLs: Placeholder URLs (builders must provide their own)
 * - API Keys: Empty (injected at build time for official builds)
 */
export const productionConfig: Config = {
    // Algorand nodes - Public AlgoNode infrastructure (free, no authentication required)
    mainnetAlgodUrl: 'https://mainnet-api.algonode.cloud',
    testnetAlgodUrl: 'https://testnet-api.algonode.cloud',
    mainnetIndexerUrl: 'https://mainnet-idx.algonode.cloud',
    testnetIndexerUrl: 'https://testnet-idx.algonode.cloud',

    // Pera backend URLs - Placeholder values for OSS builds
    // Official builds inject real URLs via PERA_MAINNET_BACKEND_URL and PERA_TESTNET_BACKEND_URL
    mainnetBackendUrl: 'https://api.example.com',
    testnetBackendUrl: 'https://testnet-api.example.com',

    // API Keys - Empty by default, injected at build time for official builds
    backendAPIKey: '',
    algodApiKey: '',
    indexerApiKey: '',

    // Public URLs - These are safe to keep as-is
    mainnetExplorerUrl: 'https://explorer.perawallet.app',
    testnetExplorerUrl: 'https://testnet.explorer.perawallet.app',

    // Service URLs - Official Pera services (public websites)
    discoverBaseUrl: 'https://discover-mobile.perawallet.app/',
    stakingBaseUrl: 'https://staking-mobile.perawallet.app/',
    onrampBaseUrl: 'https://onramp-mobile.perawallet.app/',
    supportBaseUrl: 'https://support.perawallet.app/',
    termsOfServiceUrl: 'https://perawallet.app/terms-and-services/',
    privacyPolicyUrl: 'https://perawallet.app/privacy-policy/',
    peraDemoDappUrl: 'https://perawallet.github.io/pera-demo-dapp/',

    sendFundsFaqUrl:
        'https://support.perawallet.app/en/category/transactions-1tq8s9h/',
    swapSupportUrl:
        'https://support.perawallet.app/en/article/pera-swap-swapping-with-pera-1ep84ky/',

    // Timing configuration
    notificationRefreshTime: THIRTY_SECONDS,
    remoteConfigRefreshTime: ONE_HOUR,

    // React Query cache settings
    reactQueryDefaultGCTime: ONE_HOUR,
    reactQueryDefaultStaleTime: ONE_MINUTE,
    reactQueryShortLivedGCTime: 60 * ONE_DAY,
    reactQueryShortLivedStaleTime: 30 * ONE_SECOND,
    reactQueryPersistenceAge: 60 * ONE_DAY,

    // Feature flags
    debugEnabled: false,
    profilingEnabled: false,
    pollingEnabled: true,
}
