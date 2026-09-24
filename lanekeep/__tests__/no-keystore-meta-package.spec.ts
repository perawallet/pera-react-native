/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-keystore-meta-package.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/keystore-meta/**/*.ts'

describe('pera/no-keystore-meta-package', () => {
    it('reports the meta-package and its subpaths in any import form, tests included', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            'errorRoot.ts:1',
            'inTests.ts:1',
            'meta.ts:1',
            'meta.ts:2',
            'meta.ts:4',
            'meta.ts:5',
        ])
    })
})
