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

/**
 * The generated-env keys the extension may bake. Everything in the zip is one
 * unzip away from any user, so this is fail-closed: a key added to
 * tools/generate-config.sh stays out of the extension until it is listed here.
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
    'backendAPIKey',
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
]

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
