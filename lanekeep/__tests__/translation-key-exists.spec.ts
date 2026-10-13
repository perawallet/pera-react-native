/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/translation-key-exists.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/t-keys.*.ts'

describe('pera/translation-key-exists', () => {
    it('reports a literal t() key that is not a leaf in en.json', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            't-keys.bad.ts:3',
            't-keys.bad.ts:4',
            't-keys.bad.ts:5',
        ])
    })

    it('accepts real keys, plural bases, interpolated keys and other functions', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('t-keys.good.ts'))).toEqual([])
    })
})
