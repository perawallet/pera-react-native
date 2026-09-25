/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-i18n-integrity-suppressions.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/i18n-suppressions.*.ts'
const ID = 'pera/no-i18n-integrity-suppressions'

describe(ID, () => {
    it('reports a directive naming an i18n integrity rule, including itself', async () => {
        const found = (await runRule(RULE, FIXTURES)).filter(
            v => v.ruleId === ID,
        )

        expect(locations(found)).toEqual([
            'i18n-suppressions.bad.ts:1',
            'i18n-suppressions.bad.ts:3',
            'i18n-suppressions.bad.ts:5',
        ])
    })

    it('leaves other directives and prose alone', async () => {
        const found = (await runRule(RULE, FIXTURES)).filter(
            v => v.ruleId === ID && v.file.endsWith('.good.ts'),
        )

        expect(found).toEqual([])
    })
})
