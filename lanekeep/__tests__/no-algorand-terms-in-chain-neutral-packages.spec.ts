/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-algorand-terms-in-chain-neutral-packages.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/packages/*/src/**/{algorand-terms.*,wireFormat}.ts'

describe('pera/no-algorand-terms-in-chain-neutral-packages', () => {
    it('reports each term in imports, identifiers, comments, strings and templates', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('algorand-terms.bad.ts')),
            ),
        ).toEqual([
            'algorand-terms.bad.ts:1',
            'algorand-terms.bad.ts:2',
            'algorand-terms.bad.ts:4',
            'algorand-terms.bad.ts:5',
            'algorand-terms.bad.ts:5',
            'algorand-terms.bad.ts:7',
            'algorand-terms.bad.ts:9',
            'algorand-terms.bad.ts:11',
            'algorand-terms.bad.ts:15',
            'algorand-terms.bad.ts:17',
        ])
    })

    it('reports the device package', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('algorand-terms.device.ts')),
            ),
        ).toEqual(['algorand-terms.device.ts:2'])
    })

    it('leaves a compound that only contains Networks alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(
                v => v.file.endsWith('algorand-terms.bad.ts') && v.line === 13,
            ),
        ).toEqual([])
    })

    it('allows the wire-format file', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('wireFormat.ts'))).toEqual([])
    })

    it('leaves packages outside the chain-neutral list alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('algorand-terms.outside.ts')),
        ).toEqual([])
    })

    it('reports each chain word in a name, key, member or literal of the code-checked packages, and not in comments', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('algorand-terms.code.ts')),
            ),
        ).toEqual(
            [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(
                line => `algorand-terms.code.ts:${line}`,
            ),
        )
    })

    it('checks comments only in backup, device and migrate', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('algorand-terms.prose.ts')),
            ),
        ).toEqual(['algorand-terms.prose.ts:2', 'algorand-terms.prose.ts:3'])
    })

    it('finds nothing in the chain-neutral packages', async () => {
        const found = await runRule(
            RULE,
            'packages/{backup,device,migrate,accounts,assets,chain-shared,connections,signing,swaps,transactions}/src/**/*.{ts,tsx}',
        )

        expect(found).toEqual([])
    })
})
