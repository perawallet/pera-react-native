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

// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import fg from 'fast-glob'

const META_IMPORT = /from\s+['"]@algorandfoundation\/keystore['"]/

// The meta-package hard-depends on keystore-node (native @napi-rs/keyring) and
// keystore-web, and react-native-keystore does NOT re-export core — so a shared
// type imported from the meta-package resolves under Vitest's node condition
// and vanishes in the React Native build. keystore-chrome is exempt: it is a
// browser-target port that legitimately consumes the web surface.
describe('keystore meta-package firewall', () => {
    it('is not imported outside the chrome extension port', async () => {
        const files = await fg(
            [
                'packages/*/src/**/*.ts',
                'extensions/*/src/**/*.ts',
                'apps/*/src/**/*.ts',
            ],
            {
                cwd: process
                    .cwd()
                    .replace(/\/(packages|apps|extensions)\/.*$/, ''),
                absolute: true,
                ignore: ['**/extensions/keystore-chrome/**', '**/dist/**'],
            },
        )
        const offenders = files.filter(f =>
            META_IMPORT.test(readFileSync(f, 'utf8')),
        )
        expect(offenders).toEqual([])
    })
})
