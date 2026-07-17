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

import { z } from 'zod'
import {
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE,
    ONE_SECOND,
    TEN_SECONDS,
    THIRTY_SECONDS,
} from './constants'

import { generatedEnv } from './generated-env'

const PRODUCTION_GUARDED_URLS = [
    'mainnetBackendUrl',
    'testnetBackendUrl',
] as const

export const configSchema = z
    .object({
        mainnetBackendUrl: z.url(),
        testnetBackendUrl: z.url(),
        mainnetAlgodUrl: z.url(),
        testnetAlgodUrl: z.url(),
        mainnetIndexerUrl: z.url(),
        testnetIndexerUrl: z.url(),
        backendAPIKey: z.string(),
        algodApiKey: z.string(),
        indexerApiKey: z.string(),
        mainnetGenesisHash: z.string(),
        testnetGenesisHash: z.string(),

        mainnetExplorerUrl: z.url(),
        testnetExplorerUrl: z.url(),

        appStoreAppID: z.string(),
        playIntegrityCloudProjectNumber: z.string(),

        // Firebase Web SDK config (browser extension Remote Config). Not secret —
        // a Firebase web apiKey only identifies the project; access is governed
        // by Firebase Security Rules, not this value. Still build-time-injected
        // (not hardcoded) to keep infra config out of source-tree churn.
        firebaseApiKey: z.string(),
        firebaseAuthDomain: z.string(),
        firebaseDatabaseUrl: z.string(),
        firebaseProjectId: z.string(),
        firebaseStorageBucket: z.string(),
        firebaseMessagingSenderId: z.string(),
        firebaseAppId: z.string(),
        firebaseMeasurementId: z.string(),

        // GA4 Measurement Protocol API secret (GA4 Admin > Data Streams > your
        // web stream > Measurement Protocol API secrets) — distinct from
        // firebaseApiKey. Empty until generated; ChromeAnalyticsService no-ops
        // until both this and firebaseMeasurementId are set.
        gaMeasurementApiSecret: z.string(),

        // Sentry DSN for the browser extension's crash/error reporting. Empty
        // until a Sentry project exists; ChromeCrashReportingService no-ops
        // until set.
        sentryDsn: z.string(),

        notificationRefreshTime: z.number().int(),
        remoteConfigRefreshTime: z.number().int(),

        /** Bounded ceiling (ms) for algod/indexer GET/DELETE requests (reads). */
        algodReadTimeout: z.number().int(),
        /** Bounded ceiling (ms) for algod/indexer POST requests (e.g. broadcast). */
        algodSubmitTimeout: z.number().int(),
        /** Bounded ceiling (ms) for the signing machine's `transporting` state. */
        signingTransportTimeout: z.number().int(),

        reactQueryDefaultGCTime: z.number().int(),
        reactQueryDefaultStaleTime: z.number().int(),
        reactQueryShortLivedGCTime: z.number().int(),
        reactQueryShortLivedStaleTime: z.number().int(),
        reactQueryLongLivedGCTime: z.number().int(),
        reactQueryLongLivedStaleTime: z.number().int(),
        reactQueryPersistenceAge: z.number().int(),

        discoverBaseUrl: z.url(),
        /** XO Swap support inbox for onramp order help (bare address, no `mailto:`). */
        onrampSupportEmail: z.email(),
        /** Baanx support inbox for card transaction reports (bare address, no `mailto:`). */
        cardSupportEmail: z.email(),
        supportBaseUrl: z.url(),
        termsOfServiceUrl: z.url(),
        privacyPolicyUrl: z.url(),
        peraDemoDappUrl: z.url(),
        dispenserUrl: z.url(),

        sendFundsFaqUrl: z.url(),
        assetInboxSupportUrl: z.url(),
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
        peraCardLearnMoreUrl: z.url(),

        debugEnabled: z.boolean(),
        profilingEnabled: z.boolean(),
        pollingEnabled: z.boolean(),

        // Build-time escape hatch for e2e automation (Appium/BrowserStack), whose
        // tooling can't drive a FLAG_SECURE surface. Sourced only from the
        // DISABLE_SCREEN_CAPTURE_PREVENTION build env — never a remote/runtime
        // signal. Defaults safe (false) so seed-screen capture protection can't be
        // weakened post-release.
        disableScreenCapturePrevention: z.boolean().default(false),

        mainnetBidaliApiKey: z.string(),
        testnetBidaliApiKey: z.string(),
        mainnetBidaliBaseUrl: z.url(),
        testnetBidaliBaseUrl: z.url(),

        // Baanx card integration. Per-environment base URL + PUBLIC client key
        // (x-client-key). The Baanx x-secret-key is server-only and MUST NEVER be
        // added here — secret-key calls are proxied through Pera's backend.
        mainnetBaanxBaseUrl: z.url(),
        testnetBaanxBaseUrl: z.url(),
        mainnetBaanxClientKey: z.string(),
        testnetBaanxClientKey: z.string(),
        // Baanx tenant id sent in the consent payload (POST /v2/consent/onboarding).
        mainnetBaanxTenantId: z.string(),
        testnetBaanxTenantId: z.string(),

        // SWAP POINT: AppliedBlockchain (AB) escrow card service. Card creation and
        // the delegated-LSig `/lsig` endpoint are hosted by AB on testnet until Baanx
        // wraps them. The auth token is an AB-issued static secret sent as a RAW
        // `Authorization` header (no Bearer). Base URL uses z.string() (not z.url())
        // so an empty default validates before the values arrive. App ids and the
        // USDC asset id feed the AutoDraw LogicSig TEAL template.
        mainnetCardEscrowBaseUrl: z.string(),
        testnetCardEscrowBaseUrl: z.string(),
        mainnetCardEscrowAuthToken: z.string(),
        testnetCardEscrowAuthToken: z.string(),
        mainnetCardW3CardAppId: z.string(),
        testnetCardW3CardAppId: z.string(),
        mainnetCardKillswitchAppId: z.string(),
        testnetCardKillswitchAppId: z.string(),
        mainnetCardUsdcAssetId: z.string(),
        testnetCardUsdcAssetId: z.string(),

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

        /** Build channel. Sourced from APP_ENV; defaults to development when unset. */
        appEnvironment: z
            .enum(['development', 'staging', 'production'])
            .default('development'),

        /**
         * Full git release tag baked at build time (e.g. "v7.0.0-alpha.9"), shown
         * in-app so QA can see the exact prerelease they're testing. Sourced from
         * BITRISE_GIT_TAG; empty for local/non-tag builds (the version display then
         * falls back to the native store version).
         */
        releaseTag: z.string().default(''),

        /**
         * Incrementing CI build number baked at build time, mirroring mobile's
         * `Application.nativeBuildVersion`. Sourced from BITRISE_BUILD_NUMBER;
         * empty for local builds (getAppBuild then falls back to the manifest
         * version). Feeds the user-agent so backend/Cloudflare rules can key off
         * it the same way they do on mobile.
         */
        appBuildNumber: z.string().default(''),
    })
    .check(ctx => {
        // The committed defaults deliberately point the backend URLs at staging
        // (safe for open-source builds); production builds override them via env
        // (tools/generate-config.sh). A missing override must fail the build here,
        // loudly — not ship a production app talking to staging. (discoverBaseUrl
        // is exempt: getConfig derives it from appEnvironment structurally.)
        if (ctx.value.appEnvironment !== 'production') return
        for (const field of PRODUCTION_GUARDED_URLS) {
            if (ctx.value[field].includes('staging')) {
                ctx.issues.push({
                    code: 'custom',
                    message: `${field} points at staging in a production build — set its env override (see overrideEnvironmentMap)`,
                    path: [field],
                    input: ctx.value[field],
                })
            }
        }
    })

export type Config = z.infer<typeof configSchema>

type ConfigOverrides = Partial<Omit<Config, 'discoverBaseUrl'>>

const discoverBaseUrlByEnvironment: Record<Config['appEnvironment'], string> = {
    development: 'https://discover-mobile-staging.perawallet.app/',
    staging: 'https://discover-mobile-staging.perawallet.app/',
    production: 'https://discover-mobile.perawallet.app/',
}

/**
 * Production configuration with safe defaults for open source builds.
 */
const productionConfig: Omit<Config, 'discoverBaseUrl'> = {
    mainnetAlgodUrl: 'https://mainnet-api.algonode.cloud',
    testnetAlgodUrl: 'https://testnet-api.algonode.cloud',
    mainnetIndexerUrl: 'https://mainnet-idx.algonode.cloud',
    testnetIndexerUrl: 'https://testnet-idx.algonode.cloud',
    mainnetGenesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    testnetGenesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    mainnetBackendUrl: 'https://mainnet.staging.api.perawallet.app',
    testnetBackendUrl: 'https://testnet.staging.api.perawallet.app',
    // Injected at build time from the BACKEND_API_KEY env var via
    // tools/generate-config.sh (bitrise secrets in CI, .env locally). Empty
    // here so no key literal ships in the open-source source tree.
    backendAPIKey: '',
    algodApiKey: '',
    indexerApiKey: '',

    appStoreAppID: '',
    playIntegrityCloudProjectNumber: '',

    // Defaults to the "pera-wallet-public" Firebase project — a distinct,
    // non-sensitive project safe to ship in source (same posture as the
    // public AlgoNode URLs above). The real production Firebase project
    // ("algorand-e3fe3") is NOT checked in; it's injected at build time via
    // the FIREBASE_* env vars below for staging/production builds. A
    // Firebase web apiKey only identifies the project — it is not a secret —
    // but it's still overridable, not hardcoded-only, so official builds can
    // point at the real project without a source change.
    firebaseApiKey: 'AIzaSyA49zDfujF8SCdxQrfC38bM2TdzSFPtIJA',
    firebaseAuthDomain: 'pera-wallet-public.firebaseapp.com',
    // This project has no Realtime Database provisioned; Remote Config
    // doesn't need one. Left empty — override via FIREBASE_DATABASE_URL only
    // if a future project requires it.
    firebaseDatabaseUrl: '',
    firebaseProjectId: 'pera-wallet-public',
    firebaseStorageBucket: 'pera-wallet-public.firebasestorage.app',
    firebaseMessagingSenderId: '537717066676',
    firebaseAppId: '1:537717066676:web:6bb1d3cbae6b949172c0e1',

    // Analytics identifiers — never bake a default. Injected only for
    // staging/production via FIREBASE_MEASUREMENT_ID + GA_MEASUREMENT_API_SECRET.
    // ChromeAnalyticsService no-ops while either is empty, so open-source and
    // local builds send no analytics.
    firebaseMeasurementId: '',
    gaMeasurementApiSecret: '',
    sentryDsn: '',

    mainnetExplorerUrl: 'https://explorer.perawallet.app',
    testnetExplorerUrl: 'https://testnet.explorer.perawallet.app',
    onrampSupportEmail: 'support@xoswap.com',
    cardSupportEmail: 'support@baanx.com',
    supportBaseUrl: 'https://support.perawallet.app/',
    termsOfServiceUrl: 'https://perawallet.app/terms-and-services/',
    privacyPolicyUrl: 'https://perawallet.app/privacy-policy/',
    peraDemoDappUrl: 'https://perawallet.github.io/pera-demo-dapp/',
    sendFundsFaqUrl:
        'https://support.perawallet.app/en/category/transactions-1tq8s9h/',
    assetInboxSupportUrl:
        'https://support.perawallet.app/en/article/transacting-with-asset-inbox-1fbh60y/',
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
    // TODO(card): replace with the final Pera Card learn-more URL
    peraCardLearnMoreUrl: 'https://perawallet.app/pera-card/',

    notificationRefreshTime: THIRTY_SECONDS,
    remoteConfigRefreshTime: ONE_HOUR,
    algodReadTimeout: TEN_SECONDS,
    algodSubmitTimeout: THIRTY_SECONDS,
    signingTransportTimeout: THIRTY_SECONDS + 5 * ONE_SECOND,
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
    disableScreenCapturePrevention: false,

    mainnetBidaliApiKey: '',
    testnetBidaliApiKey: '',
    mainnetBidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    testnetBidaliBaseUrl: 'https://commerce.staging.bidali.com/dapp',

    mainnetBaanxBaseUrl: 'https://api.baanx.com',
    testnetBaanxBaseUrl: 'https://dev.api.baanx.com',
    // PUBLIC client keys (x-client-key) are injected at build time from env
    // vars (bitrise secrets in CI, .env locally) via tools/generate-config.sh.
    mainnetBaanxClientKey: '',
    testnetBaanxClientKey: '',
    // TODO(card): set the real Baanx tenant id for production via the
    // MAINNET_BAANX_TENANT_ID env/secret before shipping the card to mainnet.
    mainnetBaanxTenantId: '',
    testnetBaanxTenantId: 'perawallet',

    // SWAP POINT: AB escrow card service. Base URLs, auth tokens, and app ids
    // are injected at build time from env (bitrise secrets in CI, .env locally)
    // via tools/generate-config.sh — empty defaults keep the flow dev-mockable
    // until AB provides testnet values. The USDC asset ids default to the public
    // network assets (mirrors KNOWN_ASSET_IDS.USDC); AB may override with a test
    // asset via TESTNET_CARD_USDC_ASSET_ID.
    mainnetCardEscrowBaseUrl: '',
    testnetCardEscrowBaseUrl: '',
    mainnetCardEscrowAuthToken: '',
    testnetCardEscrowAuthToken: '',
    mainnetCardW3CardAppId: '',
    testnetCardW3CardAppId: '',
    mainnetCardKillswitchAppId: '',
    testnetCardKillswitchAppId: '',
    mainnetCardUsdcAssetId: '31566704',
    testnetCardUsdcAssetId: '10458941',

    arc59: {
        testnet: {
            appId: 643_020_148n,
            appAddress:
                'YIIC6GF4DUJYZTYTZ5UEOAXONUUKZRDFOTV4EKSGD5E7BYE6EE3IVPYEDQ',
        },
        mainnet: {
            appId: 2_449_590_623n,
            appAddress:
                'EZRVNZFJGOUZC67FUMEC7ZMVP232TPICFTQCVZ6EQEIRRT3TIHSKZULRNI',
        },
    },

    defaultNetwork: 'mainnet',
    appEnvironment: 'development',
    releaseTag: '',
    appBuildNumber: '',
}

// A map of which environment variable (if any) to read config overrides from
export const overrideEnvironmentMap: Partial<Record<keyof Config, string>> = {
    mainnetAlgodUrl: 'MAINNET_ALGOD_URL',
    testnetAlgodUrl: 'TESTNET_ALGOD_URL',
    mainnetIndexerUrl: 'MAINNET_INDEXER_URL',
    testnetIndexerUrl: 'TESTNET_INDEXER_URL',
    mainnetGenesisHash: 'MAINNET_GENESIS_HASH',
    testnetGenesisHash: 'TESTNET_GENESIS_HASH',
    mainnetBackendUrl: 'MAINNET_BACKEND_URL',
    testnetBackendUrl: 'TESTNET_BACKEND_URL',

    backendAPIKey: 'BACKEND_API_KEY',
    algodApiKey: 'ALGOD_API_KEY',
    indexerApiKey: 'INDEXER_API_KEY',

    algodReadTimeout: 'ALGOD_READ_TIMEOUT',
    algodSubmitTimeout: 'ALGOD_SUBMIT_TIMEOUT',
    signingTransportTimeout: 'SIGNING_TRANSPORT_TIMEOUT',

    appStoreAppID: 'APP_STORE_APPLE_ID',
    playIntegrityCloudProjectNumber: 'PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER',

    firebaseApiKey: 'FIREBASE_API_KEY',
    firebaseAuthDomain: 'FIREBASE_AUTH_DOMAIN',
    firebaseDatabaseUrl: 'FIREBASE_DATABASE_URL',
    firebaseProjectId: 'FIREBASE_PROJECT_ID',
    firebaseStorageBucket: 'FIREBASE_STORAGE_BUCKET',
    firebaseMessagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
    firebaseAppId: 'FIREBASE_APP_ID',
    firebaseMeasurementId: 'FIREBASE_MEASUREMENT_ID',

    gaMeasurementApiSecret: 'GA_MEASUREMENT_API_SECRET',
    sentryDsn: 'SENTRY_DSN',

    mainnetExplorerUrl: 'MAINNET_EXPLORER_URL',
    testnetExplorerUrl: 'TESTNET_EXPLORER_URL',
    onrampSupportEmail: 'ONRAMP_SUPPORT_EMAIL',
    cardSupportEmail: 'CARD_SUPPORT_EMAIL',
    supportBaseUrl: 'SUPPORT_BASE_URL',
    termsOfServiceUrl: 'TERMS_OF_SERVICE_URL',
    privacyPolicyUrl: 'PRIVACY_POLICY_URL',
    peraDemoDappUrl: 'PERA_DEMO_DAPP_URL',
    sendFundsFaqUrl: 'SEND_FUNDS_FAQ_URL',
    assetInboxSupportUrl: 'ASSET_INBOX_SUPPORT_URL',
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
    peraCardLearnMoreUrl: 'PERA_CARD_LEARN_MORE_URL',
    dispenserUrl: 'DISPENSER_URL',

    debugEnabled: 'DEBUG_ENABLED',
    profilingEnabled: 'PROFILING_ENABLED',
    pollingEnabled: 'POLLING_ENABLED',
    disableScreenCapturePrevention: 'DISABLE_SCREEN_CAPTURE_PREVENTION',

    mainnetBidaliApiKey: 'MAINNET_BIDALI_API_KEY',
    testnetBidaliApiKey: 'TESTNET_BIDALI_API_KEY',
    mainnetBidaliBaseUrl: 'MAINNET_BIDALI_BASE_URL',
    testnetBidaliBaseUrl: 'BIDALI_BASE_URL',

    mainnetBaanxBaseUrl: 'MAINNET_BAANX_BASE_URL',
    testnetBaanxBaseUrl: 'TESTNET_BAANX_BASE_URL',
    mainnetBaanxClientKey: 'MAINNET_BAANX_CLIENT_KEY',
    testnetBaanxClientKey: 'TESTNET_BAANX_CLIENT_KEY',
    mainnetBaanxTenantId: 'MAINNET_BAANX_TENANT_ID',
    testnetBaanxTenantId: 'TESTNET_BAANX_TENANT_ID',

    mainnetCardEscrowBaseUrl: 'MAINNET_CARD_ESCROW_BASE_URL',
    testnetCardEscrowBaseUrl: 'TESTNET_CARD_ESCROW_BASE_URL',
    mainnetCardEscrowAuthToken: 'MAINNET_CARD_ESCROW_AUTH_TOKEN',
    testnetCardEscrowAuthToken: 'TESTNET_CARD_ESCROW_AUTH_TOKEN',
    mainnetCardW3CardAppId: 'MAINNET_CARD_W3CARD_APP_ID',
    testnetCardW3CardAppId: 'TESTNET_CARD_W3CARD_APP_ID',
    mainnetCardKillswitchAppId: 'MAINNET_CARD_KILLSWITCH_APP_ID',
    testnetCardKillswitchAppId: 'TESTNET_CARD_KILLSWITCH_APP_ID',
    mainnetCardUsdcAssetId: 'MAINNET_CARD_USDC_ASSET_ID',
    testnetCardUsdcAssetId: 'TESTNET_CARD_USDC_ASSET_ID',

    defaultNetwork: 'DEFAULT_NETWORK',
    appEnvironment: 'APP_ENV',
    releaseTag: 'BITRISE_GIT_TAG',
    appBuildNumber: 'BITRISE_BUILD_NUMBER',
}

/**
 * Load configuration.
 * It merges the safe production defaults with the generated environment configuration.
 *
 * @returns Validated configuration object
 */
export function getConfig(overrides: ConfigOverrides = generatedEnv): Config {
    const mergedConfig = { ...productionConfig, ...overrides }

    return configSchema.parse({
        ...mergedConfig,
        discoverBaseUrl:
            discoverBaseUrlByEnvironment[mergedConfig.appEnvironment],
    })
}

export const config = getConfig()
Object.freeze(config)
