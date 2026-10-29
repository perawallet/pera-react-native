/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-color-literals-outside-theme.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/color-literals/**/*.{ts,tsx}'

describe('pera/no-color-literals-outside-theme', () => {
    it('reports hex, functional and named colour literals in makeStyles and module constants', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'color-literals.bad.ts:4',
            'color-literals.bad.ts:5',
            'color-literals.bad.ts:6',
            'color-literals.bad.ts:6',
            'color-literals.bad.ts:6',
            'color-literals.bad.ts:10',
            'color-literals.bad.ts:11',
            'color-literals.bad.ts:14',
            'color-literals.bad.ts:15',
            'color-literals.bad.ts:18',
            'color-literals.bad.ts:23',
            'color-literals.bad.ts:24',
            'color-literals.bad.ts:25',
            'color-literals.bad.ts:26',
            'color-literals.bad.ts:26',
            'color-literals.bad.ts:27',
        ])
    })

    it('names the literal in the message', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found[0]?.message).toContain("'#28A79B'")
    })
})
