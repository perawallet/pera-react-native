/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-unused-translation-keys.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/i18n-unused/**/*.ts'

describe('pera/no-unused-translation-keys', () => {
    it('reports a key nothing claims, and an error key with no exact or dynamic claim', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual(['en.json:14', 'en.json:18'])
    })

    it('says which kind of key went unclaimed', async () => {
        const messages = (await runRule(RULE, FIXTURES)).map(v => v.message)

        expect(messages).toContain('"orphan.never" is not used anywhere')
        expect(messages).toContain(
            'error key "errors.orphan_one" is not claimed by a messageKey, a keysFor() base or a t() call',
        )
    })
})
