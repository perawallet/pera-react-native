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

// The persisted React Query cache is plaintext, so nothing secret may persist.
// QUERY_PREFIX_POLICY defaults to "never", which makes a new module safe on day
// one; this sweep is what makes it deliberate, by failing until someone
// classifies the prefix they added.
//
// Source scan rather than imports: 10 of the 15 MODULE_PREFIX constants are
// module-private, and a prefix does not always match its package name
// (packages/messages declares 'notifications', packages/currencies emits an
// 'assets' key).

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { QUERY_PREFIX_POLICY } from '../query-persistence'

const REPO_ROOT = join(__dirname, '../../../../..')
const SCAN_ROOTS = [
    join(REPO_ROOT, 'packages'),
    join(REPO_ROOT, 'apps/mobile/src'),
    join(REPO_ROOT, 'extensions'),
]
const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    '__tests__',
    'test-utils',
    'coverage',
])
// Fixtures and specs invent throwaway keys ('unrelated', 'msig'); classifying
// those would be noise.
const SKIP_FILE = /\.(spec|test)\.tsx?$|^dev-fixtures$/

const PREFIX_PATTERNS = [
    // `const MODULE_PREFIX = 'accounts'`, `BANNERS_MODULE_PREFIX = 'banners'`
    /\b[A-Z_]*MODULE_PREFIX\s*(?::[^=]*)?=\s*'([^']+)'/g,
    // `export const passkeysQueryKeyRoot = ['passkeys'] as const`
    /\b\w*[qQ]uery[kK]ey\w*\s*(?::[^=]*)?=\s*\[\s*'([^']+)'/g,
    // `export const DAPP_CONNECTIONS_QUERY_KEY = ['dapp-connections']`
    /\b[A-Z_]*QUERY_KEY\w*\s*(?::[^=]*)?=\s*\[\s*'([^']+)'/g,
    // Inline `queryKey: ['rekey-transaction-fee', ...]` on a useQuery call
    /queryKey:\s*\[\s*'([^']+)'/g,
]

const listFiles = (dir: string): string[] => {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || SKIP_FILE.test(entry.name))
                continue
            out.push(...listFiles(join(dir, entry.name)))
        } else if (
            /\.tsx?$/.test(entry.name) &&
            !SKIP_FILE.test(entry.name) &&
            !entry.name.endsWith('.d.ts')
        ) {
            out.push(join(dir, entry.name))
        }
    }
    return out
}

const discoverPrefixes = (): Set<string> => {
    const prefixes = new Set<string>()
    for (const root of SCAN_ROOTS) {
        for (const file of listFiles(root)) {
            const source = readFileSync(file, 'utf-8')
            for (const pattern of PREFIX_PATTERNS) {
                for (const match of source.matchAll(pattern)) {
                    // Sub-keys like 'assets/prices' belong to their module's
                    // prefix; only the first path segment is the prefix.
                    prefixes.add(match[1].split('/')[0])
                }
            }
        }
    }
    return prefixes
}

describe('query persistence policy covers every query-key prefix', () => {
    const discovered = discoverPrefixes()

    it('classifies every prefix the codebase declares', () => {
        const unclassified = [...discovered]
            .filter(prefix => !(prefix in QUERY_PREFIX_POLICY))
            .sort()

        expect(
            unclassified,
            'Classify these query-key prefixes in QUERY_PREFIX_POLICY (apps/mobile/src/providers/query-persistence.ts). Until you do they are never persisted, which is safe but unintended.',
        ).toEqual([])
    })

    it('lists no prefix that no longer exists', () => {
        const stale = Object.keys(QUERY_PREFIX_POLICY)
            .filter(prefix => !discovered.has(prefix))
            .sort()

        expect(stale).toEqual([])
    })

    // Without this a broken scan root passes silently with an empty set, which
    // is the one failure mode that would make the whole sweep decorative.
    it('actually scanned the codebase', () => {
        expect(discovered.size).toBeGreaterThanOrEqual(
            Object.keys(QUERY_PREFIX_POLICY).length,
        )
    })
})
