/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, locations, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/no-workspace-require-in-tests.ts'

const REQUIRES = [
    "const react = require('react')",
    "const registry = require('@perawallet/wallet-extension-hardware-wallet')",
    '',
].join('\n')

describe('pera/no-workspace-require-in-tests', () => {
    it('reports require() of a workspace package in test code only', async () => {
        const found = await withScratch(
            {
                'packages/demo/src/test-utils/mocks.ts': REQUIRES,
                'packages/demo/src/thing.spec.ts': REQUIRES,
                'packages/demo/src/production.ts': REQUIRES,
            },
            async dir => {
                const runner = await createRunner(RULE, `${dir}/**/*.ts`)
                try {
                    return await runner.run()
                } finally {
                    await runner.dispose()
                }
            },
        )

        expect(locations(found)).toEqual(['mocks.ts:2', 'thing.spec.ts:2'])
    })
})
