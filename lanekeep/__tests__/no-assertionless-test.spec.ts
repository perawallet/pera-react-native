/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-assertionless-test.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/assertions/**/*.ts'

describe('pera/no-assertionless-test', () => {
    it('reports a test with no assertion, in test files only, and skips hooks', async () => {
        expect(locations(await runRule(RULE, FIXTURES))).toEqual([
            'mixed.ts:10',
        ])
    })
})
