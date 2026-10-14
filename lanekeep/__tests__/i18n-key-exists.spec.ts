/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/i18n-key-exists.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/i18n-key.*.ts'

describe('pera/i18n-key-exists', () => {
    it('reports a missing key, an object, and every argument that is not one literal', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'i18n-key.bad.ts:5',
            'i18n-key.bad.ts:6',
            'i18n-key.bad.ts:7',
            'i18n-key.bad.ts:8',
            'i18n-key.bad.ts:9',
            'i18n-key.bad.ts:10',
        ])
    })

    it('names the key it could not find, and tells a dynamic one to be spelled out', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.map(v => v.message)).toEqual([
            '"this.key.does.not.exist" is not a string in en.json',
            '"common" is not a string in en.json',
            'i18nKey() takes one string literal; spell the whole key here',
            'i18nKey() takes one string literal; spell the whole key here',
            'i18nKey() takes one string literal; spell the whole key here',
            'i18nKey() takes one string literal; spell the whole key here',
        ])
    })

    it('allows a string leaf, a plural base, an unsubstituted template, and other callees', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('.good.ts'))).toEqual([])
    })
})
