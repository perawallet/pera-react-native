/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-chrome-imports-outside-web.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/chrome-imports.*.ts'

describe('pera/no-chrome-imports-outside-web', () => {
    it('reports value imports of chrome-only packages, including subpaths', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'chrome-imports.bad.ts:1',
            'chrome-imports.bad.ts:2',
        ])
    })

    it('allows type-only imports and chrome-free packages', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('chrome-imports.good.ts')),
        ).toEqual([])
    })
})
