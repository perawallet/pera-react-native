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
        const bad = found.filter(v => v.file.endsWith('primitives.bad.tsx'))

        expect(locations(bad)).toEqual([
            'primitives.bad.tsx:1',
            'primitives.bad.tsx:1',
        ])
        expect(bad[0]?.message).toContain('PWView')
        expect(bad[1]?.message).toContain('PWText')
    })

    it('reports the imported name, not the local alias, for `{ Foo as Bar }`', async () => {
        const found = await runRule(RULE, FIXTURES)
        const aliased = found.filter(v =>
            v.file.endsWith('primitives.alias.tsx'),
        )

        expect(locations(aliased)).toEqual(['primitives.alias.tsx:1'])
        expect(aliased[0]?.message).toContain('PWView')
        expect(aliased[0]?.message).toContain('View')
        expect(aliased[0]?.message).not.toContain('MyView')
    })

    it('allows type-only imports and primitives with no PW wrapper', async () => {
        const found = await runRule(RULE, FIXTURES)
        const good = found.filter(v => v.file.endsWith('primitives.good.tsx'))

        // Line 1: `import { type ScrollView } from 'react-native'` — inline `type` modifier.
        expect(good.filter(v => v.line === 1)).toEqual([])
        // Line 2: `import type { FlatList } from 'react-native'` — type-only declaration.
        expect(good.filter(v => v.line === 2)).toEqual([])
        // Line 3: `Pressable`/`StyleSheet` have no PW wrapper.
        expect(good.filter(v => v.line === 3)).toEqual([])
        expect(good).toEqual([])
    })
})
