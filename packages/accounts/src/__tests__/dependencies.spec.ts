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

import { describe, expect, it } from 'vitest'

// This package holds only chain-generic account code: a chain's account
// concepts reach it through the adapters it registers, never an import.

// Vite's `import.meta.glob`, typed here because this package's tsconfig loads
// neither the node nor the vite/client types.
declare global {
    interface ImportMeta {
        glob<T>(
            pattern: string | string[],
            options: { eager: true; import: 'default'; query?: string },
        ): Record<string, T>
    }
}

type Manifest = Partial<
    Record<
        'dependencies' | 'devDependencies' | 'peerDependencies',
        Record<string, string>
    >
>

const manifest = Object.values(
    import.meta.glob<Manifest>('../../package.json', {
        eager: true,
        import: 'default',
    }),
)[0]

const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
    eager: true,
    import: 'default',
    query: '?raw',
})

const ALLOWED_CHAIN_PACKAGES = new Set([
    '@perawallet/wallet-core-chain-contract',
    '@perawallet/wallet-core-chain-shared',
])

const isForbidden = (name: string): boolean =>
    name === 'algosdk' ||
    name === '@perawallet/wallet-core-blockchain' ||
    (name.startsWith('@perawallet/wallet-core-chain-') &&
        !ALLOWED_CHAIN_PACKAGES.has(name))

const SPECIFIER =
    /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|vi\.mock\(\s*['"]([^'"]+)['"]/g

const packageOf = (specifier: string): string =>
    specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0]

describe('accounts package dependencies', () => {
    it('declares no chain package but the contract and shared ones, and no algosdk', () => {
        const declared = (
            ['dependencies', 'devDependencies', 'peerDependencies'] as const
        ).flatMap(field => Object.keys(manifest?.[field] ?? {}))

        expect(declared).toContain('@perawallet/wallet-core-chain-contract')
        expect(declared.filter(isForbidden)).toEqual([])
    })

    it('imports no chain package but the contract and shared ones, and no algosdk', () => {
        const files = Object.entries(sources)
        const offending = files.flatMap(([file, source]) =>
            [...source.matchAll(SPECIFIER)]
                .map(match => match[1] ?? match[2] ?? match[3])
                .filter(specifier => isForbidden(packageOf(specifier)))
                .map(specifier => `${file}: ${specifier}`),
        )

        expect(files.length).toBeGreaterThan(50)
        expect(offending).toEqual([])
    })

    // Device registration is the one writer of the device's accounts, so a
    // create or update here must never reach the devices API.
    it('neither declares nor imports the device package', () => {
        const DEVICE = '@perawallet/wallet-core-device'
        const declared = (
            ['dependencies', 'devDependencies', 'peerDependencies'] as const
        ).flatMap(field => Object.keys(manifest?.[field] ?? {}))
        const importers = Object.entries(sources).filter(([, source]) =>
            [...source.matchAll(SPECIFIER)].some(
                match => packageOf(match[1] ?? match[2] ?? match[3]) === DEVICE,
            ),
        )

        expect(declared).not.toContain(DEVICE)
        expect(importers.map(([file]) => file)).toEqual([])
    })
})
