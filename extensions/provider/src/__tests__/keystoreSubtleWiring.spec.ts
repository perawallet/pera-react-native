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

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Every other provider spec mocks `WithKeyStore` wholesale, so nothing asserts
 * the registered migration context is well-formed. That gap shipped a
 * deterministic, every-device defect green: upstream's adoption pass received
 * `subtle: undefined` and skipped every record.
 */
describe('keystore provider options', () => {
    it('passes a subtle implementation into options.keystore', () => {
        const source = readFileSync(
            resolve(__dirname, '../singleton.ts'),
            'utf8',
        )
        const keystoreOptions = source.slice(
            source.indexOf('keystore: {'),
            source.indexOf('migrations: {'),
        )

        expect(keystoreOptions).toContain('subtle')
    })

    // `singleton.ts` has no `.web.ts` twin and `index.ts` exports it
    // unconditionally for both platforms, so it must never pull in a
    // react-native-only runtime import — `react-native-quick-crypto` is
    // externalised in vite.config.ts and survives unresolved into web dist.
    it('does not import react-native-quick-crypto directly', () => {
        const source = readFileSync(
            resolve(__dirname, '../singleton.ts'),
            'utf8',
        )

        expect(source).not.toContain('react-native-quick-crypto')
    })

    // The native/`.web.ts` split for `subtle` must actually exist, or the
    // check above is vacuous.
    it('sources subtle from a platform-split module', () => {
        const source = readFileSync(
            resolve(__dirname, '../singleton.ts'),
            'utf8',
        )

        expect(source).toContain("from './keystore/subtle'")

        const native = readFileSync(
            resolve(__dirname, '../keystore/subtle.ts'),
            'utf8',
        )
        const web = readFileSync(
            resolve(__dirname, '../keystore/subtle.web.ts'),
            'utf8',
        )

        expect(native).toContain('react-native-quick-crypto')
        expect(web).not.toContain('react-native-quick-crypto')
    })
})
