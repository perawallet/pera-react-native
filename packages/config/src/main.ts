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

/**
 * First-party hosts only. Third-party sandboxes legitimately keep a staging
 * host in a production build — `testnetBidaliBaseUrl` pairs testnet with the
 * vendor's sandbox — so the production staging guard below ignores them.
 */
const isFirstPartyUrl = (url: string): boolean => url.includes('perawallet.app')

/**
 * Excludes `discoverBaseUrl`: getConfig derives it from appEnvironment
 * structurally, so there is nothing to override.
 */
const hasEnvOverride = (field: string): boolean =>
    field in overrideEnvironmentMap

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

        // Networks without a Pera backend. Chain endpoints only — their Pera
        // service traffic has no Pera backend and fails typed (see createPeraClient).
        betanetAlgodUrl: z.url(),
        betanetIndexerUrl: z.url(),
        betanetGenesisHash: z.string(),
        betanetExplorerUrl: z.url(),
        /** Per-network faucet. Empty for MainNet, which has none. */
        mainnetDispenserUrl: z.string(),

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

        // Firebase Console > Cloud Messaging > Web Push certificates. Public
        // key; Chrome's push service rejects the SDK's built-in default.
        firebaseVapidKey: z.string(),

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

        // Escape hatch for e2e automation, whose tooling can't drive a
        // FLAG_SECURE surface. Build env only, never a runtime signal, and
        // defaults false so capture protection can't be weakened post-release.
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

        // AppliedBlockchain hosts card creation and the `/lsig` endpoint on
        // testnet until Baanx wraps them. The auth token is a static secret sent
        // as a RAW `Authorization` header, no Bearer. `z.string()` not
        // `z.url()`, so the empty default validates before values arrive.
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

        /**
         * Deliberately NOT the full `Network` union: `custom` has no baked chain
         * config, so no build-time value could make it valid — and defaulting to
         * it would leave every endpoint `''` on first launch.
         */
        defaultNetwork: z
            .enum(['mainnet', 'testnet', 'betanet'])
            .default('mainnet'),

        /** Build channel. Sourced from APP_ENV; defaults to development when unset. */
        appEnvironment: z
            .enum(['development', 'staging', 'production'])
            .default('development'),

        /**
         * Baked from BITRISE_GIT_TAG so QA can see the exact prerelease. Empty
         * for local builds, where the display falls back to the store version.
         */
        releaseTag: z.string().default(''),

        /**
         * Baked from BITRISE_BUILD_NUMBER, empty locally. Feeds the user-agent so
         * backend/Cloudflare rules can key off it as they do on mobile.
         */
        appBuildNumber: z.string().default(''),
    })
    .check(ctx => {
        // Committed defaults point first-party URLs at staging, safe for
        // open-source builds; production overrides them via env. This is the last
        // line of defence behind generate-config.sh, matched by VALUE rather than
        // a hand-kept field list so a future staging default can't slip past.
        if (ctx.value.appEnvironment !== 'production') return
        for (const [field, value] of Object.entries(ctx.value)) {
            if (typeof value !== 'string') continue
            if (!value.includes('staging') || !isFirstPartyUrl(value)) continue
            if (!hasEnvOverride(field)) continue
            ctx.issues.push({
                code: 'custom',
                message: `${field} points at staging in a production build — set ${overrideEnvironmentMap[field as keyof Config]}`,
                path: [field],
                input: value,
            })
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

    // Defaults to a distinct non-sensitive Firebase project, safe to ship in
    // source; the real one is injected at build time via FIREBASE_* env. A web
    // apiKey only identifies a project and isn't a secret, but keeping it
    // overridable lets official builds repoint without a source change.
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
    firebaseVapidKey: '',
    sentryDsn: '',

    mainnetExplorerUrl: 'https://explorer.perawallet.app',
    testnetExplorerUrl: 'https://testnet.explorer.perawallet.app',
    betanetAlgodUrl: 'https://betanet-api.algonode.cloud',
    betanetIndexerUrl: 'https://betanet-idx.algonode.cloud',
    betanetGenesisHash: 'mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0=',
    betanetExplorerUrl: 'https://lora.algokit.io/betanet',
    mainnetDispenserUrl: '',
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

    // AB escrow card service, injected at build time from env. Empty defaults
    // keep the flow dev-mockable until AB provides testnet values. USDC ids
    // default to the public network assets; AB may override with a test asset.
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
    firebaseVapidKey: 'FIREBASE_VAPID_KEY',

    gaMeasurementApiSecret: 'GA_MEASUREMENT_API_SECRET',
    sentryDsn: 'SENTRY_DSN',

    mainnetExplorerUrl: 'MAINNET_EXPLORER_URL',
    testnetExplorerUrl: 'TESTNET_EXPLORER_URL',
    betanetAlgodUrl: 'BETANET_ALGOD_URL',
    betanetIndexerUrl: 'BETANET_INDEXER_URL',
    betanetGenesisHash: 'BETANET_GENESIS_HASH',
    betanetExplorerUrl: 'BETANET_EXPLORER_URL',
    mainnetDispenserUrl: 'MAINNET_DISPENSER_URL',
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

/** Merges the safe production defaults with the generated env configuration. */
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
