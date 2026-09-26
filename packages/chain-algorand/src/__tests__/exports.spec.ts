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
// jsdom rewrites import.meta.url to a non-file URL, which readFileSync rejects.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const AREAS = [
    'blockchain',
    'signing',
    'accounts',
    'assets',
    'transactions',
    'swaps',
    'asa-inbox',
    'nfd',
    'arc0027',
    'fee-delegation',
    'multisig',
    'card',
    'onramp',
    'ledger',
    'backup',
    'connect',
]

type ExportTarget = { types: string; default: string }

const manifest: { exports: Record<string, ExportTarget> } = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
)

const barrels: Record<string, () => Promise<unknown>> = {
    '.': () => import('..'),
    './blockchain': () => import('../blockchain'),
    './signing': () => import('../signing'),
    './accounts': () => import('../accounts'),
    './assets': () => import('../assets'),
    './transactions': () => import('../transactions'),
    './swaps': () => import('../swaps'),
    './asa-inbox': () => import('../asa-inbox'),
    './nfd': () => import('../nfd'),
    './arc0027': () => import('../arc0027'),
    './fee-delegation': () => import('../fee-delegation'),
    './multisig': () => import('../multisig'),
    './card': () => import('../card'),
    './onramp': () => import('../onramp'),
    './ledger': () => import('../ledger'),
    './backup': () => import('../backup'),
    './connect': () => import('../connect'),
}

describe('chain-algorand exports', () => {
    it('maps exactly the root and one subpath per area', () => {
        expect(Object.keys(manifest.exports)).toEqual([
            '.',
            ...AREAS.map(area => `./${area}`),
        ])
    })

    it.each(Object.keys(barrels))(
        '%s points at its dist barrel and resolves from src',
        async key => {
            const dir = key === '.' ? '' : `${key.slice(2)}/`

            expect(manifest.exports[key]).toEqual({
                types: `./dist/${dir}index.d.ts`,
                default: `./dist/${dir}index.js`,
            })
            await expect(barrels[key]()).resolves.toBeDefined()
        },
        // A populated barrel cold-imports its whole module graph on first load.
        30_000,
    )
})
