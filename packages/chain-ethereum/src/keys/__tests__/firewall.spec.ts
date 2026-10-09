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
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Ethereum keys live only in the keystore. `pera/secp256k1-library-seam`
// fences production source (keep `isSecp256k1Library` there and this list in
// step); this also covers the package's tests and `viem/accounts`, which
// derives keys in JS through @scure/bip32.

const PACKAGE_ROOT = resolve(__dirname, '../../..')
const SRC = join(PACKAGE_ROOT, 'src')
const THIS_SPEC = relative(SRC, __filename)

const SPECIFIER =
    /(?:(?:import|export)\s[^'"]*?from\s+|import\s*|(?:import|require|importActual|importMock)\s*\(\s*)['"]([^'"]+)['"]/g

const FORBIDDEN_DEPENDENCIES = [
    '@noble/secp256k1',
    '@scure/bip32',
    '@noble/curves',
]

const isForbidden = (specifier: string): boolean =>
    specifier === '@noble/secp256k1' ||
    specifier.startsWith('@noble/secp256k1/') ||
    specifier === '@scure/bip32' ||
    specifier.startsWith('@scure/bip32/') ||
    /^@noble\/curves\/secp256k1(\.js)?$/.test(specifier) ||
    specifier === 'viem/accounts'

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return sourceFiles(path)
        return /\.tsx?$/.test(entry.name) ? [relative(SRC, path)] : []
    })

describe('chain-ethereum secp256k1 firewall', () => {
    const files = sourceFiles(SRC).filter(file => file !== THIS_SPEC)

    it('scans the key derivation and its tests', () => {
        expect(files).toContain(join('keys', 'derivation.ts'))
        expect(files).toContain(join('keys', '__tests__', 'derivation.spec.ts'))
    })

    it('imports no secp256k1 library anywhere in the package', () => {
        const offenders = files.flatMap(file =>
            [...readFileSync(join(SRC, file), 'utf8').matchAll(SPECIFIER)]
                .map(([, specifier]) => specifier)
                .filter(isForbidden)
                .map(specifier => `${file}: ${specifier}`),
        )

        expect(offenders).toEqual([])
    })

    it('declares no secp256k1 library as a dependency', () => {
        const manifest = JSON.parse(
            readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'),
        ) as Record<string, Record<string, string> | undefined>
        const declared = [
            ...Object.keys(manifest.dependencies ?? {}),
            ...Object.keys(manifest.devDependencies ?? {}),
            ...Object.keys(manifest.peerDependencies ?? {}),
            ...Object.keys(manifest.optionalDependencies ?? {}),
        ]

        expect(
            declared.filter(name => FORBIDDEN_DEPENDENCIES.includes(name)),
        ).toEqual([])
    })

    // The kms barrel loads react-native-mmkv; only its constants are pure.
    it('reaches kms only through its constants entry point', () => {
        const barrelImports = files.filter(file =>
            [...readFileSync(join(SRC, file), 'utf8').matchAll(SPECIFIER)].some(
                ([, specifier]) => specifier === '@perawallet/wallet-core-kms',
            ),
        )

        expect(barrelImports).toEqual([])
    })
})
