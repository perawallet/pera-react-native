/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/locale-placeholder-suffix.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/i18n-suffix/**/*.ts'

describe('pera/locale-placeholder-suffix', () => {
    it('reports a suffix on a placeholder, apostrophes and Turkish letters included', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'tr.json:3',
            'tr.json:4',
            'tr.json:5',
            'tr.json:6',
        ])
    })

    it('names the key', async () => {
        const messages = (await runRule(RULE, FIXTURES)).map(v => v.message)

        expect(messages).toContain(
            '"send.apostrophe" attaches a suffix to a {{placeholder}}',
        )
    })
})
