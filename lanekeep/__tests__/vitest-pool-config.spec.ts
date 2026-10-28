/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/vitest-pool-config.ts'

const config = (test: string): string =>
    `export default { test: { ${test} } }\n`

describe('pera/vitest-pool-config', () => {
    it('requires the pool in packages and the globals setup first wherever the pool runs', async () => {
        const found = await withScratch(
            {
                'packages/no-pool/vitest.config.ts': config(
                    "setupFiles: ['./setup.ts']",
                ),
                'packages/no-setup/vitest.config.ts': config('...poolConfig'),
                'packages/late-setup/vitest.config.ts': config(
                    "...poolConfig, setupFiles: ['./setup.ts', vmGlobalsSetup]",
                ),
                'packages/good/vitest.config.ts': config(
                    "...poolConfig, setupFiles: [vmGlobalsSetup, './setup.ts']",
                ),
                'packages/forks/vitest.config.ts': config(
                    "...poolConfig, setupFiles: [vmGlobalsSetup], projects: [{ test: { pool: 'forks', setupFiles: ['./setup.ts'] } }]",
                ),
                'apps/browser/vitest.config.ts': config(
                    "setupFiles: ['./setup.ts']",
                ),
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

        expect(
            found.map(v => [v.file.split('/').slice(-2, -1)[0], v.message]),
        ).toEqual([
            ['late-setup', 'list `vmGlobalsSetup` first in `setupFiles`'],
            ['no-pool', 'spread `poolConfig` into `test`'],
            ['no-setup', 'list `vmGlobalsSetup` in `setupFiles`'],
        ])
    })
})
