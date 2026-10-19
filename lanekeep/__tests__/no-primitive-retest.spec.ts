/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-primitive-retest.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/primitive-retest/**/*.tsx'

describe('pera/no-primitive-retest', () => {
    it('reports primitive re-test titles in mobile test files and passes behavioural ones', async () => {
        expect(locations(await runRule(RULE, FIXTURES))).toEqual([
            'primitiveTitles.tsx:1',
            'primitiveTitles.tsx:2',
            'primitiveTitles.tsx:3',
            'primitiveTitles.tsx:4',
            'primitiveTitles.tsx:5',
            'primitiveTitles.tsx:6',
            'primitiveTitles.tsx:7',
            'primitiveTitles.tsx:8',
            'primitiveTitles.tsx:9',
            'primitiveTitles.tsx:10',
            'primitiveTitles.tsx:11',
            'primitiveTitles.tsx:12',
            'primitiveTitles.tsx:13',
            'primitiveTitles.tsx:16',
        ])
    })
})
