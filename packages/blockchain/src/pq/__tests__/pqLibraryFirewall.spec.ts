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

import {
    readdirSync,
    readFileSync,
    existsSync,
    mkdtempSync,
    writeFileSync,
    rmSync,
} from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect } from 'vitest'

// Pera's quantum (post-quantum, Falcon-1024) accounts integrate Joe Polny's
// interim PQ libraries behind a swap seam so they can later be replaced with
// official Algorand code via a one-module change. See
// docs/QUANTUM_PQ_INTEGRATION.md. `@joe-p/algosdk` is no longer one of the
// forbidden specifiers, and is no longer installed at all: the PQ transaction
// surface now comes from official `algosdk` itself (3.7.0, resolved by the
// `algosdk` catalog range in pnpm-workspace.yaml), so application code
// imports `algosdk` everywhere, including in the former Seam B. Only the Falcon
// libraries (`@joe-p/react-native-falcon`, WASM `falcon-1024`), which still
// have no official counterpart, remain confined to Seam A. The quote class
// includes backticks so template-literal dynamic imports (e.g.
// `import(\`falcon-1024\`)`) are caught too. The falcon-1024 alternative also
// allows an optional subpath (e.g. `falcon-1024/wasm`) so a deep import can't
// slip past a bare-specifier-only check.
const QUOTED_PQ_LIBRARY_SOURCE =
    '[`\'"](@joe-p/react-native-falcon|falcon-1024(?:/[^\'"`]*)?)[`\'"]'

// A quoted MENTION of a PQ library — an import, a bundler `external` entry, or
// a plain string that merely looks like one. Not what the guard enforces; it
// only documents the build-config blind spot below.
const SPECIFIER_MENTION_PATTERN = new RegExp(QUOTED_PQ_LIBRARY_SOURCE)

// What the guard actually enforces: a mention only counts as a dependency edge
// when it sits in an import position (`from '…'`, `import('…')`,
// `require('…')`). Requiring that context is load-bearing, not cosmetic:
// `'falcon-1024'` is ALSO keystore-core's `KeyType` literal — the value of
// `FALCON_CHILD_KEY_TYPE` — so a quote-only match flags every plain type
// literal in the repo while proving nothing about what gets bundled.
const FORBIDDEN_SPECIFIER_PATTERN = new RegExp(
    `(?:\\bfrom|\\bimport|\\brequire)\\s*\\(?\\s*${QUOTED_PQ_LIBRARY_SOURCE}`,
)

// Seam A (pure crypto) is the sole remaining sanctioned home for these
// imports IN THIS REPO. `@joe-p/algosdk` is no longer forbidden anywhere — the
// PQ surface ships in official `algosdk` (see pnpm-workspace.yaml), so Seam B
// (packages/blockchain/src/pq) no longer needs an allowlist entry.
//
// It is no longer the app's only edge to the native Falcon module, though:
// `@algorandfoundation/react-native-keystore` reaches `@joe-p/react-native-falcon`
// itself, as an optional peer, from `loadDefaultFalconBinding`
// (`react-native-keystore@1.0.0-canary.19`, `dist/falcon.js:72`, wired into the
// engine at `dist/engine.js:207`). That edge lives in node_modules, is not
// scanned here, and cannot be — it is upstream's. So this guard bounds where
// OUR source may name the PQ libraries; it is not a claim that the bundle
// contains exactly one reference to them.
const ALLOWLISTED_SEAM_DIRS = ['packages/kms/src/crypto/pq']

// Scanned roots. `tools/` is deliberately NOT scanned and is an accepted blind
// spot of this guard: dev-only scripts there are never bundled into the app and
// legitimately need the PQ libs directly. Concretely,
// `tools/localnet-quantum-check.ts` imports `falcon-1024` on purpose — it drives
// a real keypair through derive → sign → assemble → submit against LocalNet,
// which cannot be done through the seam (the seam's provider intentionally
// exposes no raw key material for a script to reuse). Do NOT extend the scan to
// `tools/` to "close" this: it would only force an allowlist entry for a
// non-shipping script and buy no safety.
const SCAN_ROOT_DIRS = ['packages', 'apps']

// `__tests__` is excluded tree-wide (not just in the seam dirs): tests
// legitimately import the PQ libs directly and are never shipped, so a leak
// planted inside a non-seam `__tests__` folder is a deliberate, accepted
// blind spot of this guard.
const SKIPPED_DIR_NAMES = new Set(['node_modules', '.git', 'dist', '__tests__'])

// Build-config files (e.g. `vite.config.ts`, `vitest.config.ts`) are a
// deliberate, accepted blind spot — the same class as `__tests__` above. They
// run at BUILD time, are never shipped in the runtime bundle, and legitimately
// both NAME and IMPORT external packages: a bundler
// `external: ['@joe-p/react-native-falcon']` entry is a build directive
// telling the bundler "don't inline this; the app's Metro bundler resolves
// it", and a config may equally need to `import` a package to configure it.
// The exemption is scoped to the `*.config.(ts|tsx)` filename suffix so it
// cannot widen to arbitrary source files — a genuine
// `import ... from '@joe-p/...'` in a non-config, non-seam source file is
// still caught (see the regression test below).
const BUILD_CONFIG_FILE_PATTERN = /\.config\.(ts|tsx)$/

const isBuildConfigFile = (fileName: string): boolean =>
    BUILD_CONFIG_FILE_PATTERN.test(fileName)

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
        if (!/\.(ts|tsx)$/.test(entry.name)) return []
        // Build configs name externals legitimately; deliberate blind spot.
        if (isBuildConfigFile(entry.name)) return []
        return [fullPath]
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

    it('confines @joe-p/react-native-falcon and falcon-1024 imports to the one remaining swap seam', () => {
        const files = SCAN_ROOT_DIRS.flatMap(dir =>
            listSourceFilesRecursively(root, join(root, dir)),
        )

        // A rename/removal of packages or apps can't silently drop coverage.
        expect(files.length).toBeGreaterThan(0)
        expect(findViolations(files)).toEqual([])
    })

    it('no longer forbids algosdk, which now ships the PQ surface itself', () => {
        expect(FORBIDDEN_SPECIFIER_PATTERN.test("from 'algosdk'")).toBe(false)
        expect(FORBIDDEN_SPECIFIER_PATTERN.test("from '@joe-p/algosdk'")).toBe(
            false,
        )
        expect(FORBIDDEN_SPECIFIER_PATTERN.test("from 'falcon-1024'")).toBe(
            true,
        )
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test(
                "from '@joe-p/react-native-falcon'",
            ),
        ).toBe(true)
    })

    it('importing @algorandfoundation/react-native-keystore is allowed, even though it reaches the native Falcon module itself', () => {
        // The guard is specifier-based, not reachability-based. The RN keystore
        // is the sanctioned way to get keystore-core types and the sealed
        // signing surface; that it loads `@joe-p/react-native-falcon` internally
        // (see the note above ALLOWLISTED_SEAM_DIRS) does not make importing it
        // a seam breach. Note this guard bounds SPECIFIERS, not key-material
        // reach: the RN keystore publicly exports `loadDefaultFalconBinding`
        // (`dist/falcon.d.ts:61`, re-exported by `dist/index.d.ts`) and
        // keystore-core a WASM `createFalconBinding` (`dist/defaults.d.ts:76`,
        // re-exported by `dist/index.d.ts`), so raw Falcon material is
        // obtainable from anywhere without naming a banned specifier. Custody
        // is enforced by the keystore's sealed API, not by this guard.
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test(
                "from '@algorandfoundation/react-native-keystore'",
            ),
        ).toBe(false)
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test(
                "from '@algorandfoundation/keystore-core'",
            ),
        ).toBe(false)

        // ...while naming the native module directly still is.
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test(
                "from '@joe-p/react-native-falcon'",
            ),
        ).toBe(true)
    })

    it("regression: a bare 'falcon-1024' type literal is NOT a violation, but importing it still is", () => {
        // `falcon-1024` is simultaneously an npm package name and
        // keystore-core's `KeyType` for a Falcon signing child, so
        // `FALCON_CHILD_KEY_TYPE`, the `k.type === …` guards and the
        // integration double all spell it as a plain string. Those are type
        // literals, not dependency edges, and a quote-only regex flagged every
        // one of them.
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test(
                "export const FALCON_CHILD_KEY_TYPE = 'falcon-1024'",
            ),
        ).toBe(false)
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test("if (key.type === 'falcon-1024')"),
        ).toBe(false)

        // ...while every real import position still trips it.
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test(
                "import { generateKey } from 'falcon-1024'",
            ),
        ).toBe(true)
        expect(FORBIDDEN_SPECIFIER_PATTERN.test("import 'falcon-1024'")).toBe(
            true,
        )
        expect(
            FORBIDDEN_SPECIFIER_PATTERN.test("require('falcon-1024/wasm')"),
        ).toBe(true)
        expect(FORBIDDEN_SPECIFIER_PATTERN.test('import(`falcon-1024`)')).toBe(
            true,
        )
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

        // The real import in the real seam file must still trip the ENFORCED
        // pattern. This is what proves tightening the regex to an import
        // context did not blind the guard: were the seam not exempt, this file
        // would be reported as a violation.
        expect(findViolations([file])).toEqual([`${file} → falcon-1024`])
    })

    it('regression: a sibling dir merely prefixed by a seam name (e.g. pq-legacy) is NOT treated as inside the seam', () => {
        // Under the old raw `path.startsWith(join(root, seamDir))` check,
        // `.../crypto/pq-legacy` would satisfy `startsWith('.../crypto/pq')`
        // and be silently skipped from scanning, making the guard vacuous for
        // any file placed under such a sibling. This pins the fix.
        const seamSiblingFile = join(
            root,
            'packages',
            'kms',
            'src',
            'crypto',
            'pq-legacy',
            'x.ts',
        )
        expect(isInsideSeam(root, seamSiblingFile)).toBe(false)

        // Sanity check that genuine seam paths (and nested files within
        // them) are still correctly classified as inside.
        const genuineSeamFile = join(
            root,
            'packages',
            'kms',
            'src',
            'crypto',
            'pq',
            'wasmFalconProvider.ts',
        )
        expect(isInsideSeam(root, genuineSeamFile)).toBe(true)
    })

    it('build-config files are a deliberate blind spot: an @joe-p external string in vite.config.ts is NOT flagged', () => {
        // packages/kms/vite.config.ts declares '@joe-p/react-native-falcon' in
        // rollup `external` (a build directive — the app's Metro bundler
        // resolves the native module — not a runtime import). It genuinely
        // names the PQ library, yet must be excluded from the scan.
        const viteConfig = join(root, 'packages', 'kms', 'vite.config.ts')
        const content = readFileSync(viteConfig, 'utf-8')
        expect(content).toMatch(SPECIFIER_MENTION_PATTERN)

        expect(isBuildConfigFile('vite.config.ts')).toBe(true)
        expect(isBuildConfigFile('vitest.config.ts')).toBe(true)

        // ...and it is actually dropped from the collected scan set, so the
        // main guard above stays green because of the exemption (not because
        // the string is absent).
        const scanned = SCAN_ROOT_DIRS.flatMap(dir =>
            listSourceFilesRecursively(root, join(root, dir)),
        )
        expect(scanned).not.toContain(viteConfig)
    })

    it('regression: a real @joe-p/react-native-falcon import in a non-config, non-seam source file IS still flagged (exemption cannot widen)', () => {
        // The build-config exemption is scoped to the `*.config.ts` filename
        // suffix. A plain source file with the same import must still trip the
        // guard, so the blind spot can never be widened to arbitrary files.
        const tmpDir = mkdtempSync(join(tmpdir(), 'pq-firewall-'))
        try {
            const leakFile = join(tmpDir, 'leak.ts')
            writeFileSync(
                leakFile,
                "import { x } from '@joe-p/react-native-falcon'\n",
            )

            expect(isBuildConfigFile('leak.ts')).toBe(false)
            expect(findViolations([leakFile])).toEqual([
                `${leakFile} → @joe-p/react-native-falcon`,
            ])
        } finally {
            rmSync(tmpDir, { recursive: true, force: true })
        }
    })
})
