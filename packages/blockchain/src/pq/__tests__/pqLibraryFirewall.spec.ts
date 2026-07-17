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

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { describe, it, expect } from 'vitest'

// Pera's quantum (post-quantum, Falcon-1024) accounts integrate Joe Polny's
// interim PQ libraries (`@joe-p/algosdk`, WASM `falcon-1024`) behind two swap
// seams so they can later be replaced with official Algorand code via a
// one-module change. See docs/QUANTUM_PQ_INTEGRATION.md. This guard pins that
// boundary: neither library may be imported anywhere else in the tree.
// The quote class includes backticks so template-literal dynamic imports
// (e.g. `import(\`@joe-p/algosdk\`)`) are caught too.
const FORBIDDEN_SPECIFIER_PATTERN = /[`'"](@joe-p\/[^'"`]*|falcon-1024)[`'"]/

// Seam A (pure crypto) and Seam B (the only `@joe-p/algosdk` importer) are
// the sole sanctioned homes for these imports.
const ALLOWLISTED_SEAM_DIRS = [
    join('packages', 'kms', 'src', 'crypto', 'pq'),
    join('packages', 'blockchain', 'src', 'pq'),
]

const SCAN_ROOT_DIRS = ['packages', 'apps']

const SKIPPED_DIR_NAMES = new Set(['node_modules', '.git', 'dist', '__tests__'])

// Resolved from __dirname rather than hardcoded, since this spec runs from
// inside a git worktree where `../../../..` would not reliably land on the
// monorepo root.
const findMonorepoRoot = (startDir: string): string => {
    let current = startDir
    while (true) {
        if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
            return current
        }
        const parent = dirname(current)
        if (parent === current) {
            throw new Error(
                `Could not locate pnpm-workspace.yaml walking up from ${startDir}`,
            )
        }
        current = parent
    }
}

// Segment-boundary comparison: a path is only "inside" a seam when it IS the
// seam dir or is nested under it (seamPath + separator). A raw `startsWith`
// would also match unrelated siblings whose name merely shares the seam
// dir's prefix (e.g. `pq-legacy` matching seam dir `pq`), silently exempting
// them from the scan. See the regression test below.
const isInsideSeam = (root: string, path: string): boolean =>
    ALLOWLISTED_SEAM_DIRS.some(seamDir => {
        const seamPath = join(root, seamDir)
        return path === seamPath || path.startsWith(seamPath + sep)
    })

const listSourceFilesRecursively = (root: string, dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (SKIPPED_DIR_NAMES.has(entry.name)) return []
            if (isInsideSeam(root, fullPath)) return []
            return listSourceFilesRecursively(root, fullPath)
        }
        return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : []
    })

const findViolations = (files: string[]): string[] =>
    files.flatMap(file => {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        return lines.flatMap(line => {
            const match = line.match(FORBIDDEN_SPECIFIER_PATTERN)
            return match ? [`${file} → ${match[1]}`] : []
        })
    })

describe('PQ library import firewall', () => {
    const root = findMonorepoRoot(__dirname)

    it('confines @joe-p/* and falcon-1024 imports to the two swap seams', () => {
        const files = SCAN_ROOT_DIRS.flatMap(dir =>
            listSourceFilesRecursively(root, join(root, dir)),
        )

        // A rename/removal of packages or apps can't silently drop coverage.
        expect(files.length).toBeGreaterThan(0)
        expect(findViolations(files)).toEqual([])
    })

    it('positive control: quantumAdapter.ts still imports @joe-p/algosdk (Seam B)', () => {
        const file = join(
            root,
            'packages',
            'blockchain',
            'src',
            'pq',
            'quantumAdapter.ts',
        )
        const content = readFileSync(file, 'utf-8')
        expect(content).toMatch(/['"]@joe-p\/algosdk['"]/)
    })

    it('positive control: wasmFalconProvider.ts still imports falcon-1024 (Seam A)', () => {
        const file = join(
            root,
            'packages',
            'kms',
            'src',
            'crypto',
            'pq',
            'wasmFalconProvider.ts',
        )
        const content = readFileSync(file, 'utf-8')
        expect(content).toMatch(/['"]falcon-1024['"]/)
    })

    it('regression: a sibling dir merely prefixed by a seam name (e.g. pq-legacy) is NOT treated as inside the seam', () => {
        // Under the old raw `path.startsWith(join(root, seamDir))` check,
        // `.../src/pq-legacy` would satisfy `startsWith('.../src/pq')` and be
        // silently skipped from scanning, making the guard vacuous for any
        // file placed under such a sibling. This pins the fix.
        const seamSiblingFile = join(
            root,
            'packages',
            'blockchain',
            'src',
            'pq-legacy',
            'x.ts',
        )
        expect(isInsideSeam(root, seamSiblingFile)).toBe(false)

        // Sanity check that genuine seam paths (and nested files within
        // them) are still correctly classified as inside.
        const genuineSeamFile = join(
            root,
            'packages',
            'blockchain',
            'src',
            'pq',
            'quantumAdapter.ts',
        )
        expect(isInsideSeam(root, genuineSeamFile)).toBe(true)
    })
})
