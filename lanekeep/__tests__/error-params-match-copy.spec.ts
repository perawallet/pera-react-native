/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/error-params-match-copy.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/error-params.*.ts'

describe('pera/error-params-match-copy', () => {
    it('reports a placeholder with no matching param, declared or absent', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'error-params.bad.ts:2',
            'error-params.bad.ts:7',
        ])
    })

    it('skips containers whose params cannot be read statically', async () => {
        const found = await runRule(RULE, FIXTURES)

        // Shorthand `params` and a container spread are unverifiable, not
        // "no params declared" — reporting them would flag working code.
        expect(found.filter(v => v.file.endsWith('.good.ts'))).toEqual([])
    })
})
