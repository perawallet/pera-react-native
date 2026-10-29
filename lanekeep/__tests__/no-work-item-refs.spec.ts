/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-work-item-refs.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/work-items/*.{ts,tsx,mjs,py}'

describe('pera/no-work-item-refs', () => {
    it('reports line, trailing, block, JSX and Python comments and docstrings, and ignores strings and look-alikes', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'narration.bad.py:2',
            'narration.bad.py:6',
            'narration.bad.ts:1',
            'narration.bad.ts:2',
            'narration.bad.ts:3',
            'narration.bad.ts:8',
            'narration.bad.ts:9',
            'narration.bad.ts:10',
            'narration.bad.ts:11',
            'narration.bad.ts:12',
            'narration.bad.ts:13',
            'narration.bad.ts:14',
            'narration.bad.ts:15',
            'narration.bad.ts:16',
            'refs.bad.mjs:1',
            'refs.bad.ts:1',
            'refs.bad.ts:2',
            'refs.bad.ts:4',
            'refs.bad.ts:8',
            'refs.bad.ts:9',
            'refs.bad.tsx:3',
            // This fixture's parse root is ERROR, not program; comments must still match.
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

    it('names the phrase each kind of history matched', async () => {
        const found = await runRule(RULE, FIXTURES)
        const message = (file: string, line: number) =>
            found.find(v => v.file.endsWith(file) && v.line === line)?.message

        expect(message('narration.bad.ts', 1)).toContain('This used to')
        expect(message('narration.bad.ts', 11)).toContain('PR "#1234"')
        expect(message('narration.bad.ts', 13)).toContain('sat 75s')
        expect(message('narration.bad.ts', 13)).toContain('measured timing')
        expect(message('narration.bad.py', 6)).toContain('narrates history')
    })
})
