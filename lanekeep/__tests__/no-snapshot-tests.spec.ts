/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-snapshot-tests.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/snapshots/**/*.ts'

describe('pera/no-snapshot-tests', () => {
    it('reports every snapshot matcher in test files only', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'usesSnapshots.ts:1',
            'usesSnapshots.ts:2',
            'usesSnapshots.ts:3',
            'usesSnapshots.ts:4',
        ])
    })
})
