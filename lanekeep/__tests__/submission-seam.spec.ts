/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BROADCASTER_OWNERS } from '../rules/submission-seam.js'
import { REPO_ROOT, locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/submission-seam.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/submission-seam/**/*.ts'

describe('pera/submission-seam', () => {
    it('reports every submit outside the broadcaster owners, and no mention in a comment or string', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            'submitExtension.ts:2',
            'submitLeaks.ts:2',
            'submitLeaks.ts:4',
            'submitLeaks.ts:5',
            'submitLeaks.ts:6',
        ])
    })

    it('guards owners that still hold the real submit calls', () => {
        const read = (path: string) =>
            readFileSync(join(REPO_ROOT, path), 'utf8')

        expect(
            read(
                join(
                    BROADCASTER_OWNERS[0],
                    'signing/submission/submitRawSignedTransactionGroup.ts',
                ),
            ),
        ).toMatch(/\.sendRawTransaction\(/)
        expect(
            read(
                join(
                    BROADCASTER_OWNERS[1],
                    'blockchain/utils/createEvmClient.ts',
                ),
            ),
        ).toMatch(/eth_sendRawTransaction/)
    })
})
