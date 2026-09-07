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

        const definitelyMissing = found.filter(v =>
            v.message.includes('with no matching param'),
        )
        expect(locations(definitelyMissing)).toEqual([
            'error-params.bad.ts:5',
            'error-params.bad.ts:10',
        ])
    })

    it('reports params it cannot read statically as unverified, not as missing', async () => {
        const found = await runRule(RULE, FIXTURES)

        const unverified = found.filter(v =>
            v.message.includes("can't be confirmed as supplied"),
        )
        expect(locations(unverified)).toEqual([
            'error-params.bad.ts:14',
            'error-params.bad.ts:20',
            'error-params.bad.ts:24',
        ])
    })

    it('stays silent when every placeholder has a matching param, extras included', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('.good.ts'))).toEqual([])
    })
})
