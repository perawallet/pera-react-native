/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-secret-in-logs.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secret-flows/**/*.ts'

describe('pera/no-secret-in-logs', () => {
    it('reports secret material reaching a log, analytics or error sink', async () => {
        expect(locations(await runRule(RULE, FIXTURES))).toEqual([
            'leaks.ts:4',
            'leaks.ts:5',
            'leaks.ts:6',
            'leaks.ts:7',
            'leaks.ts:8',
        ])
    })
})
