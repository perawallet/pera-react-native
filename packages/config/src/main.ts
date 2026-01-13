/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 limitations under the License
 */

import { z } from 'zod';
import {
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE,
    ONE_SECOND,
    THIRTY_SECONDS,
} from './constants';

import { generatedEnv } from './generated-env';

export const configSchema = z.object({
    mainnetBackendUrl: z.string().url(),
    testnetBackendUrl: z.string().url(),
    mainnetAlgodUrl: z.string().url(),
    testnetAlgodUrl: z.string().url(),
    mainnetIndexerUrl: z.string().url(),
    testnetIndexerUrl: z.string().url(),
    backendAPIKey: z.string(),
    algodApiKey: z.string(),
    indexerApiKey: z.string(),

    mainnetExplorerUrl: z.string().url(),
    testnetExplorerUrl: z.string().url(),

    notificationRefreshTime: z.number().int(),
    remoteConfigRefreshTime: z.number().int(),

    reactQueryDefaultGCTime: z.number().int(),
    reactQueryDefaultStaleTime: z.number().int(),
    reactQueryShortLivedGCTime: z.number().int(),
    reactQueryShortLivedStaleTime: z.number().int(),
    reactQueryPersistenceAge: z.number().int(),

    discoverBaseUrl: z.string().url(),
    stakingBaseUrl: z.string().url(),
    onrampBaseUrl: z.string().url(),
    supportBaseUrl: z.string().url(),
    termsOfServiceUrl: z.string().url(),
    privacyPolicyUrl: z.string().url(),
    peraDemoDappUrl: z.string().url(),

    sendFundsFaqUrl: z.string().url(),
    swapSupportUrl: z.string().url(),

    debugEnabled: z.boolean(),
    profilingEnabled: z.boolean(),
    pollingEnabled: z.boolean(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Production configuration with safe defaults for open source builds.
 */
const productionConfig = {
    mainnetAlgodUrl: 'https://mainnet-api.algonode.cloud',
    testnetAlgodUrl: 'https://testnet-api.algonode.cloud',
    mainnetIndexerUrl: 'https://mainnet-idx.algonode.cloud',
    testnetIndexerUrl: 'https://testnet-idx.algonode.cloud',
    mainnetBackendUrl: 'https://api.example.com',
    testnetBackendUrl: 'https://testnet-api.example.com',
    backendAPIKey: '',
    algodApiKey: '',
    indexerApiKey: '',
    mainnetExplorerUrl: 'https://explorer.perawallet.app',
    testnetExplorerUrl: 'https://testnet.explorer.perawallet.app',
    discoverBaseUrl: 'https://discover-mobile.perawallet.app/',
    stakingBaseUrl: 'https://staking-mobile.perawallet.app/',
    onrampBaseUrl: 'https://onramp-mobile.perawallet.app/',
    supportBaseUrl: 'https://support.perawallet.app/',
    termsOfServiceUrl: 'https://perawallet.app/terms-and-services/',
    privacyPolicyUrl: 'https://perawallet.app/privacy-policy/',
    peraDemoDappUrl: 'https://perawallet.github.io/pera-demo-dapp/',
    sendFundsFaqUrl: 'https://support.perawallet.app/en/category/transactions-1tq8s9h/',
    swapSupportUrl: 'https://support.perawallet.app/en/article/pera-swap-swapping-with-pera-1ep84ky/',
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
};

/**
 * Load configuration.
 * It merges the safe production defaults with the generated environment configuration.
 * 
 * @returns Validated configuration object
 */
export function getConfig(): Config {
    const mergedConfig = { ...productionConfig, ...generatedEnv };

    return configSchema.parse(mergedConfig);
}

export const config = getConfig();
Object.freeze(config);
