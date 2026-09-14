/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-wc-imports-in-connections-module.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/apps/**/wc-imports.*.ts'

describe('pera/no-wc-imports-in-connections-module', () => {
    it('reports every form of the dependency inside modules/connections — static, type-only, subpath, re-export and deferred', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(found.filter(v => v.file.endsWith('wc-imports.bad.ts'))),
        ).toEqual([
            'wc-imports.bad.ts:6',
            'wc-imports.bad.ts:7',
            'wc-imports.bad.ts:8',
            'wc-imports.bad.ts:10',
            'wc-imports.bad.ts:11',
            'wc-imports.bad.ts:13',
        ])
    })

    // The deeplink pairing handlers are a registry entry point, so they are in
    // the same lane: the one WC import they had was the log-context redaction,
    // now the registry's own `describeUri`.
    it('reports the dependency in the deeplink handlers too', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('wc-imports.deeplink.ts')),
            ),
        ).toEqual(['wc-imports.deeplink.ts:6', 'wc-imports.deeplink.ts:7'])
    })

    it('allows the same import outside modules/connections', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('wc-imports.elsewhere.ts')),
        ).toEqual([])
    })
})
