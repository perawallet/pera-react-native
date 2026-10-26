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

// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs')
const path = require('path')

// The developer screen gallery's only entry points. Everything else in the
// gallery (screens, gallery-catalog) is reachable solely through these two, so
// swapping them is what drops the whole tree from a production bundle.
const DEVELOPER_GALLERY_MODULES = [
    'src/routes/developer-gallery',
    'src/modules/settings/routes/developer-gallery',
]

// Every app entry into the chain-ethereum package: the bootstrap module, which
// chain-adapters.ts reaches it through, and the EVM chain UI, which the
// chain-UI registry reaches it through. Swapping them drops viem.
const EVM_CHAIN_MODULES = [
    'src/bootstrap/evm-chain-modules',
    'src/modules/ethereum/chain-ui',
]

// The chains chain-ethereum serves, from the network table the app registers.
const EVM_CHAIN_IDS = Object.keys(
    require('../../packages/chain-contract/src/models/evm-networks.json'),
)

/**
 * Whether a build's chain list ships any EVM chain, and so needs viem.
 *
 * @param {readonly string[]} chainIds
 * @returns {boolean}
 */
const listsEvmChain = chainIds =>
    chainIds.some(chainId => EVM_CHAIN_IDS.includes(chainId))

// The E2E fixture deeplink's only entry points. It rewrites wallet state on
// command, so it ships only in a bundle built for a device test run.
const E2E_FIXTURE_MODULES = [
    'src/modules/deeplink/dev-e2e-fixture-parser',
    'src/modules/deeplink/handlers/useE2eFixtureDeeplink',
]

/**
 * The `appEnvironment` baked into packages/config/src/generated-env.ts, which
 * is exactly what `config.appEnvironment` reads at runtime. Undefined when the
 * file or the key is absent (the runtime then defaults to `development`).
 *
 * @param {string} generatedEnvPath
 * @returns {string | undefined}
 */
const readBakedAppEnvironment = generatedEnvPath => {
    if (!fs.existsSync(generatedEnvPath)) return undefined
    const source = fs.readFileSync(generatedEnvPath, 'utf8')
    return source.match(/^\s*appEnvironment:\s*"([^"]*)"/m)?.[1]
}

/**
 * The chain ids baked into packages/config/src/generated-env.ts, which is
 * exactly what `config.chains` reads at runtime. Undefined when the file or
 * the key is absent (the runtime then defaults to Algorand alone).
 *
 * @param {string} generatedEnvPath
 * @returns {string[] | undefined}
 */
const readBakedChainIds = generatedEnvPath => {
    if (!fs.existsSync(generatedEnvPath)) return undefined
    const source = fs.readFileSync(generatedEnvPath, 'utf8')
    const list = source.match(/^\s*chainIds:\s*"([^"]*)"/m)?.[1]
    return list
        ?.split(',')
        .map(id => id.trim())
        .filter(Boolean)
}

/**
 * Either source saying production excludes the gallery: the baked value is
 * what the app will report at runtime, and APP_ENV covers a bundle started
 * before generate-config.sh rewrote the file.
 *
 * @param {{ bakedAppEnvironment?: string, appEnv?: string }} sources
 * @returns {boolean}
 */
const isDeveloperGalleryIncluded = ({ bakedAppEnvironment, appEnv }) =>
    bakedAppEnvironment !== 'production' && appEnv !== 'production'

/**
 * Opt-in only: `E2E_FIXTURES` must EQUAL '1', so an unset or mistyped value
 * stubs. A production bundle that asks for it throws instead of quietly
 * stubbing, so a misconfigured release pipeline fails loudly.
 *
 * @param {{ e2eFixtures?: string, bakedAppEnvironment?: string, appEnv?: string }} sources
 * @returns {boolean}
 */
const isE2eFixturesIncluded = ({ e2eFixtures, bakedAppEnvironment, appEnv }) => {
    if (e2eFixtures !== '1') return false
    if (bakedAppEnvironment === 'production' || appEnv === 'production') {
        throw new Error(
            'E2E_FIXTURES=1 is refused for a production bundle: the fixture deeplink rewrites wallet state.',
        )
    }
    return true
}

/**
 * Opt-in only, like the E2E fixtures: `BENCH` must EQUAL '1'. The benchmark
 * app wipes and reseeds its storage, so a production bundle that asks for it
 * throws instead of quietly building the wrong app.
 *
 * @param {{ bench?: string, bakedAppEnvironment?: string, appEnv?: string }} sources
 * @returns {boolean}
 */
const isBenchBuild = ({ bench, bakedAppEnvironment, appEnv }) => {
    if (bench !== '1') return false
    if (bakedAppEnvironment === 'production' || appEnv === 'production') {
        throw new Error('BENCH=1 is refused for a production bundle.')
    }
    return true
}

/**
 * Maps each module's resolved `.ts` path to its sibling `.stub.ts`.
 *
 * @param {string} projectRoot
 * @param {string[]} modulePaths relative to projectRoot, without extension
 * @returns {Record<string, string>}
 */
const toStubMap = (projectRoot, modulePaths) =>
    Object.fromEntries(
        modulePaths.map(modulePath => [
            path.resolve(projectRoot, `${modulePath}.ts`),
            path.resolve(projectRoot, `${modulePath}.stub.ts`),
        ]),
    )

module.exports = {
    DEVELOPER_GALLERY_MODULES,
    E2E_FIXTURE_MODULES,
    EVM_CHAIN_MODULES,
    isDeveloperGalleryIncluded,
    isBenchBuild,
    isE2eFixturesIncluded,
    listsEvmChain,
    readBakedAppEnvironment,
    readBakedChainIds,
    toStubMap,
}
