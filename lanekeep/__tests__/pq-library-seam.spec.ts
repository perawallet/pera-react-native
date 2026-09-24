/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PQ_SEAM_DIR } from '../shared/firewall-paths.js'
import { REPO_ROOT, locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/pq-library-seam.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/pq-seam/**/*.ts'

describe('pera/pq-library-seam', () => {
    it('reports every import form outside the seam, integration specs included', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            // tree-sitter-typescript misparses the `importOriginal<typeof
            // import(...)>()` shape in this fixture's callback, so the
            // file's parse root is ERROR rather than program. The rule's
            // query must still match the plain import on line 1.
            'errorRoot.ts:1',
            'flow.ts:1',
            'leaks.ts:1',
            'leaks.ts:2',
            'leaks.ts:3',
            'leaks.ts:5',
            'leaks.ts:6',
            'requireClause.ts:1',
            'sibling.ts:1',
        ])
    })

    it('guards a seam that still holds the real Falcon import', () => {
        const provider = readFileSync(
            join(REPO_ROOT, PQ_SEAM_DIR, 'wasmFalconProvider.ts'),
            'utf8',
        )

        // wasmFalconProvider.ts loads falcon-1024 via a lazy `require(...)`
        // call (see its own comment), never a top-level `import … from`.
        expect(provider).toMatch(/\b(?:require|import)\(\s*['"]falcon-1024['"]/)
    })
})
