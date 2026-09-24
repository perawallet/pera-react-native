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
    isDeveloperGalleryIncluded,
    readBakedAppEnvironment,
    toStubMap,
}
