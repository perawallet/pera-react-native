// @vitest-environment node
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

import { join } from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { VIEM_MARKER, assertNoViem } from '../bundle-content.mjs'

const CHAIN_ETHEREUM = join(__dirname, '../../../../packages/chain-ethereum')

describe('assertNoViem', () => {
    it('passes a bundle without viem', () => {
        expect(() => assertNoViem('const a = 1', 'background.js')).not.toThrow()
    })

    it('throws naming the surface when viem is present', () => {
        expect(() =>
            assertNoViem(`x("${VIEM_MARKER}2.57.0")`, 'background.js'),
        ).toThrow(/^background\.js contains viem but CHAINS does not list/)
    })

    // Minification must not erase the one string the guard keys on.
    it('still sees viem in a minified bundle of it', async () => {
        const { outputFiles } = await build({
            stdin: {
                contents: "export { http, createPublicClient } from 'viem'",
                resolveDir: CHAIN_ETHEREUM,
                loader: 'ts',
            },
            bundle: true,
            format: 'esm',
            minify: true,
            write: false,
        })

        expect(() => assertNoViem(outputFiles[0].text, 'bundle')).toThrow(
            /contains viem/,
        )
    })
})
