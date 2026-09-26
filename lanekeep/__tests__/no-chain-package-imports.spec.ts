/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import {
    COMPOSITION_ROOTS,
    TEST_PATHS,
    TRANSITIONAL_ALLOWLIST,
} from '../shared/chain-package-allowlist.js'
import { locations, runRule, type Violation } from './helpers.js'

const RULE = 'lanekeep/rules/no-chain-package-imports.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/**/{chain-imports.*,chain-adapters,index}.ts'

const inFile = (found: Violation[], suffix: string) =>
    locations(found.filter(v => v.file.endsWith(suffix)))

describe('pera/no-chain-package-imports', () => {
    it('reports every form of a chain-package import from a shared package, and leaves chain-contract and chain-shared alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'accounts/src/chain-imports.bad.ts')).toEqual([
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

        expect(inFile(found, 'chain-imports.shared.ts')).toEqual([
            'chain-imports.shared.ts:6',
        ])
    })

    it('allows the same imports from the chain-adapter composition root', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'bootstrap/chain-adapters.ts')).toEqual([])
    })

    it('allows a chain package to import itself', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'chain-imports.self.ts')).toEqual([])
    })

    it('reports a chain package importing another chain package', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'chain-imports.cross.ts')).toEqual([
            'chain-imports.cross.ts:6',
        ])
    })

    it('allows test harness files outside __tests__', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'chain-imports.test-utils.ts')).toEqual([])
    })

    it('limits a whole-move shim to its own subpath', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'asa-inbox/src/index.ts')).toEqual(['index.ts:6'])
    })

    it('lets app files reach only the whole-moved subpaths', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'chain-imports.transitional.ts')).toEqual([
            'chain-imports.transitional.ts:8',
            'chain-imports.transitional.ts:9',
        ])
    })

    it('gives every composition root, test path and allowlist entry a reason', () => {
        const entries = [
            ...COMPOSITION_ROOTS,
            ...TEST_PATHS,
            ...TRANSITIONAL_ALLOWLIST,
        ]

        expect(entries.filter(e => e.reason.trim() === '')).toEqual([])
    })
})
