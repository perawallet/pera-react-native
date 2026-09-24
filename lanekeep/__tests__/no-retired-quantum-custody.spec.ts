/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT, locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-retired-quantum-custody.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/quantum-custody/**/*.{ts,tsx}'

describe('pera/no-retired-quantum-custody', () => {
    it('is pinned to extensions/provider/src, its only extension root', () => {
        expect(existsSync(join(REPO_ROOT, 'extensions/provider/src'))).toBe(
            true,
        )
    })

    it('reports the retired names in code, comments, strings, regexes and JSX', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            // tree-sitter-typescript misparses the `importOriginal<typeof
            // import(...)>()` shape in this fixture's callback, so the
            // file's parse root is ERROR rather than program. The rule's
            // query must still match the plain string literal on line 1.
            'errorRoot.ts:1',
            'p.tsx:1',
            'stale.ts:1',
            'stale.ts:2',
            'stale.ts:3',
            'stale.ts:4',
            'stale.ts:5',
            'stillScanned.ts:1',
        ])
    })
})
