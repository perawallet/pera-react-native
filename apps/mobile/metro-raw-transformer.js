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

// @ts-check

const fs = require('fs')
const svgTransformer = require('react-native-svg-transformer')
const defaultTransformer = require('@expo/metro-config/babel-transformer')

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
