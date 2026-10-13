/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/amount-types.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/amount-types/**/*.ts'

describe('pera/amount-types', () => {
    it('reports amounts, balances, prices and fees typed number or string', async () => {
        // `balances: number[]` stays silent: the type oracle doesn't type arrays.
        expect(locations(await runRule(RULE, FIXTURES))).toEqual([
            'model.ts:4',
            'model.ts:5',
            'model.ts:6',
        ])
    })
})
