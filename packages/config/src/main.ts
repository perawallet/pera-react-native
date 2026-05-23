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
    reactQueryLongLivedGCTime: z.number().int(),
    reactQueryLongLivedStaleTime: z.number().int(),
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
    multisigSupportUrl: z.url(),
    algorandDefiUrl: z.url(),
    asaVerificationUrl: z.url(),
    accountTypeSupportUrl: z.url(),
    ledgerAccountSupportUrl: z.url(),
    recoveryPassphraseSupportUrl: z.url(),
    watchAccountSupportUrl: z.url(),
    rekeyToStandardSupportUrl: z.url(),
    rekeyToSharedSupportUrl: z.url(),
    rekeyToLedgerSupportUrl: z.url(),
    undoRekeySupportUrl: z.url(),

    debugEnabled: z.boolean(),
    profilingEnabled: z.boolean(),
    pollingEnabled: z.boolean(),

    mainnetBidaliApiKey: z.string(),
    testnetBidaliApiKey: z.string(),
    mainnetBidaliBaseUrl: z.url(),
    testnetBidaliBaseUrl: z.url(),

    arc59: z.object({
        testnet: z.object({
            appId: z.bigint(),
            appAddress: z.string(),
        }),
        mainnet: z.object({
            appId: z.bigint(),
            appAddress: z.string(),
        }),
    }),

    defaultNetwork: z.enum(['mainnet', 'testnet']).default('mainnet'),
})

export type Config = z.infer<typeof configSchema>

/**
 * Default configuration pointing at production Pera infrastructure.
 * API keys/tokens are injected via `.env` → `generated-env.ts` (gitignored).
 */
const productionConfig = {
    mainnetAlgodUrl: 'https://node-mainnet.chain.perawallet.app',
    testnetAlgodUrl: 'https://node-testnet.chain.perawallet.app',
    mainnetIndexerUrl: 'https://indexer-mainnet.chain.perawallet.app',
    testnetIndexerUrl: 'https://indexer-testnet.chain.perawallet.app',
    mainnetBackendUrl: 'https://mainnet.api.perawallet.app',
    testnetBackendUrl: 'https://testnet.api.perawallet.app',
    backendAPIKey: '',
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
    multisigSupportUrl:
        'https://support.perawallet.app/en/article/introduction-to-joint-accounts-1j0dt2g/',
    dispenserUrl: 'https://lora.algokit.io/testnet/fund/',
    algorandDefiUrl: 'https://algorand.co/ecosystem/defi',
    asaVerificationUrl: 'https://explorer.perawallet.app/asa-verification/',
    accountTypeSupportUrl:
        'https://support.perawallet.app/en/article/create-a-new-algorand-account-on-pera-wallet-1ehbj11/',
    ledgerAccountSupportUrl:
        'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
    recoveryPassphraseSupportUrl:
        'https://support.perawallet.app/en/article/recover-or-import-an-algorand-account-with-recovery-passphrase-11gdh1y/',
    watchAccountSupportUrl: 'https://perawallet.app/support/watch-accounts/',
    rekeyToStandardSupportUrl:
        'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
    rekeyToSharedSupportUrl:
        'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
    rekeyToLedgerSupportUrl:
        'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
    undoRekeySupportUrl:
        'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',

    notificationRefreshTime: THIRTY_SECONDS,
    remoteConfigRefreshTime: ONE_HOUR,
    reactQueryDefaultGCTime: ONE_HOUR,
    reactQueryDefaultStaleTime: ONE_MINUTE,
    reactQueryShortLivedGCTime: 60 * ONE_DAY,
    reactQueryShortLivedStaleTime: 30 * ONE_SECOND,
    // Capped under setTimeout's 32-bit signed int limit (~24.8 days). Going
    // higher causes Node's setTimeout to clamp the value to 1ms, which would
    // make React Query GC immediately.
    reactQueryLongLivedGCTime: 21 * ONE_DAY,
    reactQueryLongLivedStaleTime: 7 * ONE_DAY,
    reactQueryPersistenceAge: 60 * ONE_DAY,

    debugEnabled: false,
    profilingEnabled: false,
    pollingEnabled: true,

    mainnetBidaliApiKey: '',
    testnetBidaliApiKey: '',
    mainnetBidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    testnetBidaliBaseUrl: 'https://commerce.staging.bidali.com/dapp',

    arc59: {
        testnet: {
            appId: 643020148n,
            appAddress:
                'YIIC6GF4DUJYZTYTZ5UEOAXONUUKZRDFOTV4EKSGD5E7BYE6EE3IVPYEDQ',
        },
        mainnet: {
            appId: 2449590623n,
            appAddress:
                'EZRVNZFJGOUZC67FUMEC7ZMVP232TPICFTQCVZ6EQEIRRT3TIHSKZULRNI',
        },
    },

    defaultNetwork: 'mainnet',
}

// A map of which environment variable (if any) to read config overrides from
export const overrideEnvironmentMap: Partial<Record<keyof Config, string>> = {
    mainnetAlgodUrl: 'MAINNET_ALGOD_URL',
    testnetAlgodUrl: 'TESTNET_ALGOD_URL',
    mainnetIndexerUrl: 'MAINNET_INDEXER_URL',
    testnetIndexerUrl: 'TESTNET_INDEXER_URL',
    mainnetBackendUrl: 'MAINNET_BACKEND_URL',
    testnetBackendUrl: 'TESTNET_BACKEND_URL',

    // Injected via `.env` → `generated-env.ts`
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
    multisigSupportUrl: 'MULTISIG_SUPPORT_URL',
    algorandDefiUrl: 'ALGORAND_DEFI_URL',
    asaVerificationUrl: 'ASA_VERIFICATION_URL',
    accountTypeSupportUrl: 'ACCOUNT_TYPE_SUPPORT_URL',
    ledgerAccountSupportUrl: 'LEDGER_ACCOUNT_SUPPORT_URL',
    recoveryPassphraseSupportUrl: 'RECOVERY_PASSPHRASE_SUPPORT_URL',
    watchAccountSupportUrl: 'WATCH_ACCOUNT_SUPPORT_URL',
    rekeyToStandardSupportUrl: 'REKEY_TO_STANDARD_SUPPORT_URL',
    rekeyToSharedSupportUrl: 'REKEY_TO_SHARED_SUPPORT_URL',
    rekeyToLedgerSupportUrl: 'REKEY_TO_LEDGER_SUPPORT_URL',
    undoRekeySupportUrl: 'UNDO_REKEY_SUPPORT_URL',
    dispenserUrl: 'DISPENSER_URL',

    debugEnabled: 'DEBUG_ENABLED',
    profilingEnabled: 'PROFILING_ENABLED',
    pollingEnabled: 'POLLING_ENABLED',

    mainnetBidaliApiKey: 'MAINNET_BIDALI_API_KEY',
    testnetBidaliApiKey: 'TESTNET_BIDALI_API_KEY',
    mainnetBidaliBaseUrl: 'MAINNET_BIDALI_BASE_URL',
    testnetBidaliBaseUrl: 'BIDALI_BASE_URL',

    defaultNetwork: 'DEFAULT_NETWORK',
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
