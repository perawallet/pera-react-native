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

// State here is shared by every chain, so it must not lean on any one chain's
// SDK or package; chain-contract is the only chain package it may see.
const FORBIDDEN_DEPENDENCIES = [
    /^algosdk$/,
    /^@algorandfoundation\/algokit-utils$/,
    /^@perawallet\/wallet-core-chain-(?!contract$)/,
    /^@perawallet\/wallet-core-blockchain$/,
]

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

describe('chain-shared package.json', () => {
    it('lists no chain SDK and no chain package but chain-contract', () => {
        const manifest = readManifest()

        const forbidden = DEPENDENCY_FIELDS.flatMap(field =>
            Object.keys(manifest[field] ?? {}),
        ).filter(name =>
            FORBIDDEN_DEPENDENCIES.some(pattern => pattern.test(name)),
        )

        expect(forbidden).toEqual([])
    })
})
