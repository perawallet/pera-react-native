/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-chain-package-imports.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/**/{chain-imports.*,useAppBootstrap}.ts'

describe('pera/no-chain-package-imports', () => {
    it('reports every form of a chain-package import from a shared package, and leaves chain-contract and chain-shared alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('chain-imports.bad.ts')),
            ),
        ).toEqual([
            'chain-imports.bad.ts:6',
            'chain-imports.bad.ts:7',
            'chain-imports.bad.ts:8',
            'chain-imports.bad.ts:10',
            'chain-imports.bad.ts:11',
            'chain-imports.bad.ts:13',
        ])
    })

    it('reports a chain-package import from chain-shared', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('chain-imports.shared.ts')),
            ),
        ).toEqual(['chain-imports.shared.ts:6'])
    })

    it('allows the same imports from a composition root', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('useAppBootstrap.ts')),
        ).toEqual([])
    })

    it('allows a chain package to import itself', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('chain-imports.self.ts')),
        ).toEqual([])
    })
})
