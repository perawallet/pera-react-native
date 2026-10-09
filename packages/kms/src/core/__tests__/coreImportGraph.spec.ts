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
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

// Chain adapters call the core outside any React tree, so no kms module it
// reaches may import React or a hook. Checked statically: mocking `react` at
// runtime can't isolate this, because the shared and provider barrels load it
// for every kms consumer.

const SRC = resolve(__dirname, '../..')
const SPECIFIER = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g

const resolveLocal = (from: string, spec: string): string => {
    const base = resolve(dirname(from), spec)
    const hit = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(
        existsSync,
    )
    if (!hit) throw new Error(`unresolved ${spec} from ${from}`)
    return hit
}

const walk = (entry: string) => {
    const seen = new Set<string>()
    const external = new Set<string>()
    const queue = [entry]
    while (queue.length > 0) {
        const file = queue.pop()!
        if (seen.has(file)) continue
        seen.add(file)
        for (const [, spec] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
            if (spec.startsWith('.')) queue.push(resolveLocal(file, spec))
            else external.add(spec)
        }
    }
    return {
        files: [...seen].map(f => relative(SRC, f)),
        external: [...external],
    }
}

describe('kms core import graph', () => {
    const graph = walk(resolve(SRC, 'core/index.ts'))

    test('reaches no React import', () => {
        expect(graph.external.filter(s => /^react(\/|$)/.test(s))).toEqual([])
    })

    test('reaches no hook module', () => {
        expect(graph.files.filter(f => f.startsWith('hooks/'))).toEqual([])
    })

    test('covers the operations it exports', async () => {
        const { kmsCore } = await import('../index')
        expect(Object.keys(kmsCore).sort()).toEqual([
            'createAlgo25Key',
            'createQuantumKey',
            'deriveFromSeed',
            'discardMintedSeed',
            'getKey',
            'importRawKey',
            'sign',
        ])
        expect(graph.files).toEqual(
            expect.arrayContaining([
                'core/createKmsCore.ts',
                'core/algo25Key.ts',
                'core/quantumKey.ts',
            ]),
        )
    })
})
