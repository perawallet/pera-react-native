/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SECP256K1_SEAM_DIR } from '../shared/firewall-paths.js'
import { REPO_ROOT, locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/secp256k1-library-seam.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secp256k1-seam/**/*.ts'

describe('pera/secp256k1-library-seam', () => {
    it('reports every import form outside the seam, integration specs included', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            'flow.ts:1',
            'leak.ts:1',
            'leaks.ts:1',
            'leaks.ts:2',
            'leaks.ts:3',
            'leaks.ts:4',
            'leaks.ts:6',
            'leaks.ts:7',
            'requireClause.ts:1',
            'sibling.ts:1',
        ])
    })

    it('guards a seam that still holds the real library imports', () => {
        const read = (file: string) =>
            readFileSync(join(REPO_ROOT, SECP256K1_SEAM_DIR, file), 'utf8')

        const binding = read('binding.ts')
        expect(binding).toMatch(/from ['"]@noble\/secp256k1['"]/)
        expect(binding).toMatch(/from ['"]@scure\/bip32['"]/)
    })
})
