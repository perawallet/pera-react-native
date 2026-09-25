/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/secret-buffer-zeroed.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secret-zeroing/**/*.ts'

describe('pera/secret-buffer-zeroed', () => {
    it('reports at the exit a secret buffer leaves by without being zeroed', async () => {
        expect(locations(await runRule(RULE, FIXTURES))).toEqual([
            'derive.ts:3',
            'derive.ts:8',
            'derive.ts:35',
        ])
    })
})
