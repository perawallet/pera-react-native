/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-cross-protocol-imports.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/**/cross-protocol.*.ts'

describe('pera/no-cross-protocol-imports', () => {
    it('reports imports that cross the v1/v2 boundary', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'cross-protocol.bad.ts:6',
            'cross-protocol.bad.ts:7',
        ])
    })

    it('allows shared and same-protocol sibling imports', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('cross-protocol.good.ts')),
        ).toEqual([])
    })
})
