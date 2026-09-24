/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-work-item-refs.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/work-items/*.{ts,tsx,mjs}'

describe('pera/no-work-item-refs', () => {
    it('reports line, trailing, block and JSX comments in TS, TSX and JS', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'refs.bad.mjs:1',
            'refs.bad.ts:1',
            'refs.bad.ts:2',
            'refs.bad.ts:4',
            'refs.bad.tsx:3',
            'refs.error-root.ts:6',
        ])
    })

    it('names the reference it found', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.find(v => v.file.endsWith('refs.bad.ts') && v.line === 1)
                ?.message,
        ).toContain('PERA-1234')
    })

    it('ignores strings and look-alikes', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('refs.good.ts'))).toEqual([])
    })
})
