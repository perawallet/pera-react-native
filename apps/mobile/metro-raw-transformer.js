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
const svgTransformer = require('react-native-svg-transformer')

// Resolve @expo/metro-config from expo's package directory. pnpm only links
// @expo/metro-config into apps/mobile/node_modules when it's a direct dep;
// it's a transitive dep via expo, so resolving from here would otherwise
// fail on a clean install (e.g. CI).
const expoDir = path.dirname(require.resolve('expo/package.json'))
const defaultTransformer = require(
    require.resolve('@expo/metro-config/babel-transformer', { paths: [expoDir] })
)

/**
 * Metro transformer that handles raw file imports (.sql) and SVGs,
 * delegating everything else to the default Expo Babel transformer.
 *
 * For .sql files, reads the file content and wraps it as a JS module
 * exporting the raw string — matching Vite's ?raw import behavior.
 */
module.exports.transform = function (params) {
    if (params.filename.endsWith('.sql')) {
        const content = fs.readFileSync(params.filename, 'utf8')

        return defaultTransformer.transform({
            ...params,
            src: `module.exports = ${JSON.stringify(content)};`,
        })
    }

    if (params.filename.endsWith('.svg')) {
        return svgTransformer.transform(params)
    }

    return defaultTransformer.transform(params)
}
