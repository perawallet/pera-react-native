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

import { createRequire } from 'node:module'

const evmTooling = createRequire(import.meta.url)(
    '../../../tools/dev/evm-config-keys.cjs',
)

const evmRpcUrlKeys = () =>
    evmTooling.evmScopeConfigKeys().map(keys => keys.rpcUrlKey)

/** Every EVM config key generate-config.sh can bake, from the network table. */
const evmConfigKeys = () => [
    ...evmTooling.evmChainConfigKeys().map(keys => keys.capabilitiesKey),
    ...evmTooling
        .evmScopeConfigKeys()
        .flatMap(keys => [keys.rpcUrlKey, keys.peraServicesKey]),
]

/**
 * The generated-env keys the extension may bake. Everything in the zip is one
 * unzip away from any user, so this is fail-closed: a key added to
 * tools/dev/generate-config.sh stays out of the extension until it is listed here.
 *
 * Deliberately absent: native-only identifiers (App Store id, Play Integrity
 * project, Google Drive OAuth clients) and disableScreenCapturePrevention.
 */
export const WEB_CONFIG_ALLOWLIST = [
    'mainnetAlgodUrl',
    'testnetAlgodUrl',
    'mainnetIndexerUrl',
    'testnetIndexerUrl',
    'mainnetGenesisHash',
    'testnetGenesisHash',
    'betanetAlgodUrl',
    'betanetIndexerUrl',
    'betanetGenesisHash',
    'betanetExplorerUrl',
    'mainnetDispenserUrl',
    'mainnetBackendUrl',
    'testnetBackendUrl',
    'algodApiKey',
    'indexerApiKey',
    'firebaseApiKey',
    'firebaseAuthDomain',
    'firebaseDatabaseUrl',
    'firebaseProjectId',
    'firebaseStorageBucket',
    'firebaseMessagingSenderId',
    'firebaseAppId',
    'firebaseMeasurementId',
    'firebaseVapidKey',
    // Google treats this as server-side only, but the extension posts
    // Measurement Protocol events itself; dropping it silently stops analytics.
    'gaMeasurementApiSecret',
    'sentryDsn',
    'reownProjectId',
    'appEnvironment',
    'releaseTag',
    'appBuildNumber',
    'mainnetExplorerUrl',
    'testnetExplorerUrl',
    'backupBaseUrl',
    'supportBaseUrl',
    'termsOfServiceUrl',
    'privacyPolicyUrl',
    'peraDemoDappUrl',
    'debugEnabled',
    'profilingEnabled',
    'pollingEnabled',
    'webIntegrityMintEnabled',
    'webIntegrityBearerEnabled',
    'webIntegrityEnrolEnabled',
    // Bidali's widget takes this in its iframe URL (bidali-url.web.ts).
    'mainnetBidaliApiKey',
    'testnetBidaliApiKey',
    'mainnetBidaliBaseUrl',
    'testnetBidaliBaseUrl',
    'mainnetBaanxBaseUrl',
    'testnetBaanxBaseUrl',
    'mainnetBaanxClientKey',
    'testnetBaanxClientKey',
    'mainnetCardW3CardAppId',
    'testnetCardW3CardAppId',
    'mainnetCardKillswitchAppId',
    'testnetCardKillswitchAppId',
    'mainnetCardAutoDrawProgramHash',
    'testnetCardAutoDrawProgramHash',
    'cardAutoDrawTemplateHash',
    'mainnetCardUsdcAssetId',
    'testnetCardUsdcAssetId',
    'defaultNetwork',
    // Read by the Metro chain gate and by config.chains, so a build whose
    // CHAINS lists an EVM chain ships it and every other build stays viem-free.
    'chainIds',
    'chainAlgorandCapabilities',
    // Every EVM chain's capabilities, and per network its public RPC URL and
    // Pera service list; generate-config.sh refuses a listed chain without them.
    ...evmConfigKeys(),
]

const INTEGRITY_FLAGS = {
    WEB_INTEGRITY_MINT_ENABLED: 'webIntegrityMintEnabled',
    WEB_INTEGRITY_BEARER_ENABLED: 'webIntegrityBearerEnabled',
    WEB_INTEGRITY_ENROL_ENABLED: 'webIntegrityEnrolEnabled',
}

/**
 * The integrity flags a generated-env.ts bakes, by env var name. generate-config.sh
 * leaves an unset flag out, which config reads as off.
 */
export const bakedIntegrityFlags = generatedEnvSource =>
    Object.fromEntries(
        Object.entries(INTEGRITY_FLAGS).map(([envVar, key]) => [
            envVar,
            new RegExp(`^\\s+${key}:\\s*true,`, 'm').test(generatedEnvSource),
        ]),
    )

const generatedKeys = generatedEnvSource =>
    [...generatedEnvSource.matchAll(/^\s+([A-Za-z0-9_]+):/gm)].map(
        match => match[1],
    )

/**
 * Throws when generated-env.ts carries a key outside the allowlist, so a
 * generate-config.sh that ignored CONFIG_ALLOWLIST fails the build rather than
 * shipping the key.
 */
export const assertWebConfigAllowlisted = generatedEnvSource => {
    const allowed = new Set(WEB_CONFIG_ALLOWLIST)
    const leaked = generatedKeys(generatedEnvSource).filter(
        key => !allowed.has(key),
    )
    if (leaked.length > 0) {
        throw new Error(
            'generated-env.ts holds keys the extension must not bake: ' +
                leaked.join(', '),
        )
    }
}

/**
 * The channel a generated-env.ts bakes. generate-config.sh leaves an unset
 * APP_ENV out, which config reads as development.
 */
export const bakedAppEnvironment = generatedEnvSource =>
    generatedEnvSource.match(/appEnvironment:\s*"([^"]+)"/)?.[1] ??
    'development'

/**
 * Throws unless the build is a development one. Staging and production are
 * the channels a release or store zip is built on, and an extension that
 * baked a localhost node would have no working EVM chain for its users.
 */
export const assertE2eEvmRpcOverrideAllowed = appEnvironment => {
    if (appEnvironment !== 'development') {
        throw new Error(
            `PERA_E2E_EVM_RPC_URL is set on a ${appEnvironment} build; ` +
                'it exists for the e2e bundle, which is a development build',
        )
    }
}

/**
 * Points every EVM RPC URL a generated-env.ts bakes at `url`, so an e2e bundle
 * holds no real node. Only keys that already have a value change: a chain the
 * build does not ship is not added, and one it ships is not dropped.
 */
export const overrideEvmRpcUrls = (generatedEnvSource, url) =>
    generatedEnvSource.replace(
        new RegExp(
            `^(\\s+(?:${evmRpcUrlKeys().join('|')}):\\s*)"(?:[^"\\\\]|\\\\.)*"`,
            'gm',
        ),
        (_entry, key) => `${key}${JSON.stringify(url)}`,
    )
