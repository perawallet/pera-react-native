/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-split-sentences.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/i18n-split/**/*.ts'

describe('pera/no-split-sentences', () => {
    it('reports en.json values that start or end with whitespace, and nothing in other locales', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'en.json:3',
            'en.json:4',
            'en.json:5',
            'en.json:6',
            'en.json:15',
            'en.json:16',
        ])
    })

    it('names the key', async () => {
        const messages = (await runRule(RULE, FIXTURES)).map(v => v.message)

        expect(messages).toContain(
            '"swap.powered_by" starts or ends with whitespace',
        )
    })
})
