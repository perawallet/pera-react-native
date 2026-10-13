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

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Every package may depend on this one for chain types, so a chain SDK or a
// chain package listed here would reach every consumer.
const FORBIDDEN_DEPENDENCIES = [
    /^algosdk$/,
    /^@algorandfoundation\/algokit-utils$/,
    /^viem$/,
    /^@perawallet\/wallet-core-chain-/,
]

// A leaf of the workspace graph: any other workspace package could close a
// cycle once it depends on this one, and shared already reaches algosdk.
const ALLOWED_WORKSPACE_DEPENDENCIES = ['@perawallet/wallet-core-devtools']

const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
] as const

type Manifest = Partial<
    Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>
>

const readManifest = (): Manifest =>
    JSON.parse(
        readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    )

const listedDependencies = (manifest: Manifest): string[] =>
    DEPENDENCY_FIELDS.flatMap(field => Object.keys(manifest[field] ?? {}))

describe('chain-contract package.json', () => {
    it('lists no chain SDK and no chain package', () => {
        const manifest = readManifest()

        const forbidden = listedDependencies(manifest).filter(name =>
            FORBIDDEN_DEPENDENCIES.some(pattern => pattern.test(name)),
        )

        expect(forbidden).toEqual([])
    })

    it('lists no other workspace package', () => {
        const manifest = readManifest()

        const workspaceDependencies = listedDependencies(manifest).filter(
            name =>
                name.startsWith('@perawallet/') &&
                !ALLOWED_WORKSPACE_DEPENDENCIES.includes(name),
        )

        expect(workspaceDependencies).toEqual([])
    })
})

// A type-only import resolves through hoisting without a manifest entry, so
// the manifest test alone would not catch it.
describe('chain-contract sources', () => {
    it('imports no chain SDK', () => {
        const srcDir = new URL('../', import.meta.url)
        const sdkImport =
            /(?:from|import\s*\()\s*['"](?:algosdk|@algorandfoundation\/)/

        const offenders = readdirSync(srcDir, { recursive: true })
            .map(String)
            .filter(file => file.endsWith('.ts') && !file.includes('__tests__'))
            .filter(file =>
                sdkImport.test(readFileSync(new URL(file, srcDir), 'utf8')),
            )

        expect(offenders).toEqual([])
    })
})
