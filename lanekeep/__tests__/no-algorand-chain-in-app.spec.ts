/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    ALGORAND_ONLY_FEATURES,
    type AlgorandOnlyFeature,
} from '../shared/algorand-only-features.js'
import { REPO_ROOT, locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-algorand-chain-in-app.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/apps/mobile/src/**/*algorand-chain.*.ts'

// Files that name the chain without a reason, because chain-neutral code
// should take it from its caller. Delete an entry when its file is clean; never
// add one. The list is empty and stays so: the rule is an error, and a file
// that needs Algorand on purpose goes in ALGORAND_ONLY_FEATURES with a reason.
const HIDDEN_DEFAULTS: readonly AlgorandOnlyFeature[] = []

const SHARED_APP_CODE = [
    'apps/mobile/src/components/',
    'apps/mobile/src/hooks/',
]

const namesTheChain = (file: string): boolean =>
    /\bALGORAND_CHAIN_ID\b/.test(readFileSync(resolve(REPO_ROOT, file), 'utf8'))

describe('pera/no-algorand-chain-in-app', () => {
    it('reports the import and every use of ALGORAND_CHAIN_ID in a module and in shared hooks and components', async () => {
        const found = await runRule(RULE, FIXTURES)
        const at = (suffix: string) =>
            locations(found.filter(v => v.file.endsWith(suffix)))

        expect(at('modules/algorand-chain/algorand-chain.bad.ts')).toEqual([
            'algorand-chain.bad.ts:5',
            'algorand-chain.bad.ts:9',
        ])
        expect(at('shared-hook.algorand-chain.bad.ts')).toEqual([
            'shared-hook.algorand-chain.bad.ts:5',
            'shared-hook.algorand-chain.bad.ts:9',
        ])
        expect(at('shared-component.algorand-chain.bad.ts')).toEqual([
            'shared-component.algorand-chain.bad.ts:5',
            'shared-component.algorand-chain.bad.ts:9',
        ])
    })

    it('ignores strings, comments, member access, bootstrap and modules/algorand', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => !v.file.endsWith('algorand-chain.bad.ts')),
        ).toEqual([])
    })

    it('gives every Algorand-only entry a reason and lists no file twice', () => {
        const files = ALGORAND_ONLY_FEATURES.map(feature => feature.file)

        expect(
            ALGORAND_ONLY_FEATURES.filter(
                feature => feature.reason.trim().length === 0,
            ),
        ).toEqual([])
        expect(new Set(files).size).toBe(files.length)
    })

    it('keeps shared hooks and components out of both lists', () => {
        const listed = [...ALGORAND_ONLY_FEATURES, ...HIDDEN_DEFAULTS]

        expect(
            listed.filter(feature =>
                SHARED_APP_CODE.some(dir => feature.file.startsWith(dir)),
            ),
        ).toEqual([])
    })

    it('lists only files that still name the chain', () => {
        expect(
            ALGORAND_ONLY_FEATURES.filter(
                feature => !namesTheChain(feature.file),
            ).map(feature => feature.file),
        ).toEqual([])
    })

    it('reports exactly the hidden defaults across the app, and there are none', async () => {
        const found = await runRule(RULE, 'apps/mobile/src/**/*.{ts,tsx}')

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            HIDDEN_DEFAULTS.map(feature => feature.file),
        )
        expect(HIDDEN_DEFAULTS).toEqual([])
    })
})
