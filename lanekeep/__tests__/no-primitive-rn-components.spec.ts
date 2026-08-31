/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-primitive-rn-components.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/primitives.*.tsx'

describe('pera/no-primitive-rn-components', () => {
    it('reports each banned primitive in a named import', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'primitives.bad.tsx:1',
            'primitives.bad.tsx:1',
        ])
        expect(found[0]?.message).toContain('PWView')
        expect(found[1]?.message).toContain('PWText')
    })

    it('allows type-only imports and primitives with no PW wrapper', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('primitives.good.tsx')),
        ).toEqual([])
    })
})
