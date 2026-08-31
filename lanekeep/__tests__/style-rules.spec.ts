/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const FIXTURES = 'lanekeep/__tests__/fixtures/style-rules.*.ts'
const good = (file: string): boolean => file.endsWith('style-rules.good.ts')

describe('pera/no-typography-in-styles', () => {
    it('reports typography properties and allows getTypography', async () => {
        const found = await runRule(
            'lanekeep/rules/no-typography-in-styles.ts',
            FIXTURES,
        )

        // fontSize is line 9 and fontWeight line 10 in the bad fixture.
        expect(locations(found)).toEqual([
            'style-rules.bad.ts:9',
            'style-rules.bad.ts:10',
        ])
        expect(found.filter(v => good(v.file))).toEqual([])
    })
})

describe('pera/no-empty-style-objects', () => {
    it('reports an empty style entry and names the key', async () => {
        const found = await runRule(
            'lanekeep/rules/no-empty-style-objects.ts',
            FIXTURES,
        )

        expect(locations(found)).toEqual(['style-rules.bad.ts:12'])
        expect(found[0]?.message).toContain('empty')
    })
})

describe('pera/no-numeric-sizes', () => {
    it('reports numeric spacing values, including negatives', async () => {
        const found = await runRule(
            'lanekeep/rules/no-numeric-sizes.ts',
            FIXTURES,
        )

        expect(locations(found)).toEqual([
            'style-rules.bad.ts:5',
            'style-rules.bad.ts:6',
        ])
    })

    it('allows literal 0 and does not descend into nested objects', async () => {
        const found = await runRule(
            'lanekeep/rules/no-numeric-sizes.ts',
            FIXTURES,
        )

        // `marginTop: 0` is exempt and `shadowOffset`'s inner width/height are
        // not top-level entries, so the good fixture must be clean.
        expect(found.filter(v => good(v.file))).toEqual([])
    })
})
