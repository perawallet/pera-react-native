/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-algorand-account-vocabulary.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/account-vocabulary/**/*.{ts,tsx}'

describe('pera/no-algorand-account-vocabulary', () => {
    it('reports the vocabulary outside the Algorand chain package and the composition roots', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            'bad.ts:2',
            'bad.ts:3',
            'bad.ts:5',
            'bad.ts:6',
            'bad.ts:7',
            'bad.ts:8',
            'kinds.ts:1',
            'legacy.ts:1',
            'useDemo.ts:1',
            'useDemo.ts:2',
        ])
    })
})
