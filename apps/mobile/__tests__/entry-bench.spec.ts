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

import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const read = (file: string): string =>
    readFileSync(path.resolve(__dirname, '..', file), 'utf8')

// `import 'x'` with no bindings: the polyfills the entry loads for effect.
const sideEffectImports = (source: string): string[] =>
    [...source.matchAll(/^import ['"]([^'"]+)['"]/gm)].map(match => match[1])

describe('entry.bench.js', () => {
    const nativeEntry = read('entry.native.js')
    const benchEntry = read('entry.bench.js')

    it('loads the same polyfills as the shipped entry, in the same order', () => {
        expect(sideEffectImports(benchEntry)).toEqual(
            sideEffectImports(nativeEntry),
        )
    })

    it('runs initRuntime before registering the root component', () => {
        expect(benchEntry.indexOf('initRuntime()')).toBeGreaterThan(-1)
        expect(benchEntry.indexOf('initRuntime()')).toBeLessThan(
            benchEntry.indexOf('registerRootComponent(BenchApp)'),
        )
    })
})
