/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/error-message-key-exists.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/message-key.*.ts'

describe('pera/error-message-key-exists', () => {
    it('reports a missing key and a key naming an object', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'message-key.bad.ts:1',
            'message-key.bad.ts:3',
        ])
    })

    it('allows a real string key and skips values it cannot read statically', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('.good.ts'))).toEqual([])
    })
})
