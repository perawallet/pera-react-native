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

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The lint rules see imports; this sees manifests, which is where a chain
// package or SDK would otherwise slip into a generic package's install graph.
// devDependencies are exempt: tests may build a real chain.

type WorkspaceManifest = {
    dir: string
    name: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
}

const RUNTIME_FIELDS = [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
] as const

const CHAIN_SDKS = ['algosdk', '@algorandfoundation/algokit-utils']

const SDK_OWNER = '@perawallet/wallet-core-chain-algorand'

const COMPOSITION_ROOT_DIRS = ['apps/', 'conformance']

const CHAIN_AGNOSTIC_PACKAGES = new Set([
    '@perawallet/wallet-core-chain-contract',
    '@perawallet/wallet-core-chain-shared',
])

const REPO_ROOT = new URL('../../../../', import.meta.url)

const isChainPackage = (name: string): boolean =>
    name.startsWith('@perawallet/wallet-core-chain-') &&
    !CHAIN_AGNOSTIC_PACKAGES.has(name)

const workspaceEntries = (): string[] => {
    const lines = readFileSync(
        new URL('pnpm-workspace.yaml', REPO_ROOT),
        'utf8',
    ).split('\n')
    const start = lines.findIndex(line => line.trim() === 'packages:')
    const entries: string[] = []
    for (const line of lines.slice(start + 1)) {
        if (/^\S/.test(line)) break
        const entry = /^\s+-\s+(\S+)$/.exec(line)?.[1]
        if (entry !== undefined) entries.push(entry)
    }
    return entries
}

// A deleted package leaves untracked dist/ and node_modules/ behind in a local
// checkout, so only directories holding a package.json count.
const workspaceDirs = (entry: string): string[] =>
    (entry.endsWith('/*')
        ? readdirSync(new URL(entry.slice(0, -1), REPO_ROOT), {
              withFileTypes: true,
          })
              .filter(child => child.isDirectory())
              .map(child => `${entry.slice(0, -1)}${child.name}`)
        : [entry]
    ).filter(dir => existsSync(new URL(`${dir}/package.json`, REPO_ROOT)))

const readWorkspaceManifests = (): WorkspaceManifest[] =>
    workspaceEntries()
        .flatMap(workspaceDirs)
        .map(dir => ({
            ...JSON.parse(
                readFileSync(new URL(`${dir}/package.json`, REPO_ROOT), 'utf8'),
            ),
            dir,
        }))

const runtimeDependencies = (manifest: WorkspaceManifest): string[] =>
    RUNTIME_FIELDS.flatMap(field => Object.keys(manifest[field] ?? {}))

const findChainPackageDependencies = (
    manifests: WorkspaceManifest[],
): string[] =>
    manifests
        .filter(
            manifest =>
                !COMPOSITION_ROOT_DIRS.some(root =>
                    manifest.dir.startsWith(root),
                ),
        )
        .flatMap(manifest =>
            runtimeDependencies(manifest)
                .filter(name => isChainPackage(name) && name !== manifest.name)
                .map(name => `${manifest.dir}: ${name}`),
        )

const findChainSdkDependencies = (manifests: WorkspaceManifest[]): string[] =>
    manifests
        .filter(manifest => manifest.name !== SDK_OWNER)
        .flatMap(manifest =>
            runtimeDependencies(manifest)
                .filter(name => CHAIN_SDKS.includes(name))
                .map(name => `${manifest.dir}: ${name}`),
        )

const manifestAt = (
    manifests: WorkspaceManifest[],
    dir: string,
): WorkspaceManifest => {
    const manifest = manifests.find(m => m.dir === dir)
    if (manifest === undefined) throw new Error(`no manifest at ${dir}`)
    return structuredClone(manifest)
}

describe('workspace chain-package dependency guard', () => {
    const manifests = readWorkspaceManifests()

    it('finds every workspace manifest and none for a removed package', () => {
        const dirs = manifests.map(m => m.dir)

        expect(dirs).toEqual(
            expect.arrayContaining([
                'packages/accounts',
                'packages/chain-algorand',
                'apps/mobile',
                'conformance',
            ]),
        )
        expect(dirs).not.toContain('packages/asa-inbox')
        expect(dirs).not.toContain('packages/fee-delegation')
    })

    it('resolves every workspace entry to at least one manifest', () => {
        const empty = workspaceEntries().filter(
            entry => workspaceDirs(entry).length === 0,
        )

        expect(workspaceEntries().length).toBeGreaterThan(0)
        expect(empty).toEqual([])
    })

    it('lists no chain package at runtime outside the composition roots, nor one chain inside another', () => {
        expect(findChainPackageDependencies(manifests)).toEqual([])
    })

    it('lists the Algorand SDK at runtime only in chain-algorand', () => {
        expect(findChainSdkDependencies(manifests)).toEqual([])
    })

    it('reports a copy of the accounts manifest that depends on chain-algorand', () => {
        const accounts = manifestAt(manifests, 'packages/accounts')
        accounts.dependencies = {
            ...accounts.dependencies,
            '@perawallet/wallet-core-chain-algorand': 'workspace:*',
        }

        expect(findChainPackageDependencies([accounts])).toEqual([
            'packages/accounts: @perawallet/wallet-core-chain-algorand',
        ])
    })

    it('reports a chain package that peers on another chain package', () => {
        const ethereum = manifestAt(manifests, 'packages/chain-ethereum')
        ethereum.peerDependencies = {
            ...ethereum.peerDependencies,
            '@perawallet/wallet-core-chain-algorand': 'workspace:*',
        }

        expect(findChainPackageDependencies([ethereum])).toEqual([
            'packages/chain-ethereum: @perawallet/wallet-core-chain-algorand',
        ])
    })

    it('reports the SDK in a generic package', () => {
        const accounts = manifestAt(manifests, 'packages/accounts')
        accounts.dependencies = {
            ...accounts.dependencies,
            algosdk: 'catalog:',
        }

        expect(findChainSdkDependencies([accounts])).toEqual([
            'packages/accounts: algosdk',
        ])
    })

    it('allows a chain package as a devDependency and in a composition root', () => {
        const generic: WorkspaceManifest = {
            dir: 'packages/generic',
            name: '@perawallet/wallet-core-generic',
            devDependencies: {
                '@perawallet/wallet-core-chain-ethereum': 'workspace:*',
            },
        }
        const app: WorkspaceManifest = {
            dir: 'apps/wallet',
            name: 'wallet',
            dependencies: {
                '@perawallet/wallet-core-chain-algorand': 'workspace:*',
            },
        }

        expect(findChainPackageDependencies([generic, app])).toEqual([])
    })
})
