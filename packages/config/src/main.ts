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

import { z } from 'zod'
import {
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE,
    ONE_SECOND,
    THIRTY_SECONDS,
} from './constants'

import { generatedEnv } from './generated-env'

export const configSchema = z.object({
    mainnetBackendUrl: z.url(),
    testnetBackendUrl: z.url(),
    mainnetAlgodUrl: z.url(),
    testnetAlgodUrl: z.url(),
    mainnetIndexerUrl: z.url(),
    testnetIndexerUrl: z.url(),
    backendAPIKey: z.string(),
    algodApiKey: z.string(),
    indexerApiKey: z.string(),

    mainnetExplorerUrl: z.url(),
    testnetExplorerUrl: z.url(),

    appStoreAppID: z.string(),

    notificationRefreshTime: z.number().int(),
    remoteConfigRefreshTime: z.number().int(),

    reactQueryDefaultGCTime: z.number().int(),
    reactQueryDefaultStaleTime: z.number().int(),
    reactQueryShortLivedGCTime: z.number().int(),
    reactQueryShortLivedStaleTime: z.number().int(),
    reactQueryPersistenceAge: z.number().int(),

    discoverBaseUrl: z.url(),
    stakingBaseUrl: z.url(),
    onrampBaseUrl: z.url(),
    supportBaseUrl: z.url(),
    termsOfServiceUrl: z.url(),
    privacyPolicyUrl: z.url(),
    peraDemoDappUrl: z.url(),
    dispenserUrl: z.url(),

    sendFundsFaqUrl: z.url(),
    swapSupportUrl: z.url(),

    debugEnabled: z.boolean(),
    profilingEnabled: z.boolean(),
    pollingEnabled: z.boolean(),
})

export type Config = z.infer<typeof configSchema>

/**
 * Production configuration with safe defaults for open source builds.
 */
const productionConfig = {
    mainnetAlgodUrl: 'https://mainnet-api.algonode.cloud',
    testnetAlgodUrl: 'https://testnet-api.algonode.cloud',
    mainnetIndexerUrl: 'https://mainnet-idx.algonode.cloud',
    testnetIndexerUrl: 'https://testnet-idx.algonode.cloud',
    mainnetBackendUrl: 'https://mainnet.staging.api.perawallet.app',
    testnetBackendUrl: 'https://testnet.staging.api.perawallet.app',
    //Dev API Key only - not suitable for production use
    backendAPIKey:
        'development-purposes-only-dc98f2c7-908f-4f74-81ef-9f5464213f99',
    algodApiKey: '',
    indexerApiKey: '',

    appStoreAppID: '',

    mainnetExplorerUrl: 'https://explorer.perawallet.app',
    testnetExplorerUrl: 'https://testnet.explorer.perawallet.app',
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
    dispenserUrl: 'https://lora.algokit.io/testnet/fund/',

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

// A map of which environment variable (if any) to read config overrides from
export const overrideEnvironmentMap: Partial<Record<keyof Config, string>> = {
    mainnetAlgodUrl: 'MAINNET_ALGOD_URL',
    testnetAlgodUrl: 'TESTNET_ALGOD_URL',
    mainnetIndexerUrl: 'MAINNET_INDEXER_URL',
    testnetIndexerUrl: 'TESTNET_INDEXER_URL',
    mainnetBackendUrl: 'MAINNET_BACKEND_URL',
    testnetBackendUrl: 'TESTNET_BACKEND_URL',

    //Dev API Key only - not suitable for production use
    backendAPIKey: 'BACKEND_API_KEY',
    algodApiKey: 'ALGOD_API_KEY',
    indexerApiKey: 'INDEXER_API_KEY',

    appStoreAppID: 'APP_STORE_APP_ID',

    mainnetExplorerUrl: 'MAINNET_EXPLORER_URL',
    testnetExplorerUrl: 'TESTNET_EXPLORER_URL',
    discoverBaseUrl: 'DISCOVER_BASE_URL',
    stakingBaseUrl: 'STAKING_BASE_URL',
    onrampBaseUrl: 'ONRAMP_BASE_URL',
    supportBaseUrl: 'SUPPORT_BASE_URL',
    termsOfServiceUrl: 'TERMS_OF_SERVICE_URL',
    privacyPolicyUrl: 'PRIVACY_POLICY_URL',
    peraDemoDappUrl: 'PERA_DEMO_DAPP_URL',
    sendFundsFaqUrl: 'SEND_FUNDS_FAQ_URL',
    swapSupportUrl: 'SWAP_SUPPORT_URL',
    dispenserUrl: 'DISPENSER_URL',

    debugEnabled: 'DEBUG_ENABLED',
    profilingEnabled: 'PROFILING_ENABLED',
    pollingEnabled: 'POLLING_ENABLED',
}

/**
 * Load configuration.
 * It merges the safe production defaults with the generated environment configuration.
 *
 * @returns Validated configuration object
 */
export function getConfig(): Config {
    const mergedConfig = { ...productionConfig, ...generatedEnv }

    return configSchema.parse(mergedConfig)
}

export const config = getConfig()
Object.freeze(config)
