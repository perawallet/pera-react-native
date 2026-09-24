/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPYRIGHT_HEADER } from '../shared/copyright.js'
import {
    REPO_ROOT,
    createRunner,
    locations,
    runRule,
    withScratch,
} from './helpers.js'

const RULE = 'lanekeep/rules/copyright-header.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/copyright/**/*.ts'

describe('pera/copyright-header', () => {
    it('reports shipped source and its tests when the header is missing or stale', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            'banner.ts:1',
            'bare.ts:1',
            'conf.ts:1',
            'error-root.ts:1',
            'ext.ts:1',
            'helper.ts:1',
            'pkg.ts:1',
            'stale.ts:1',
        ])
    })

    it('says whether the header is missing or out of date', async () => {
        const found = await runRule(RULE, FIXTURES)
        const message = (name: string) =>
            found.find(v => v.file.endsWith(`/${name}`))?.message

        expect(message('stale.ts')).toContain('out of date')
        expect(message('bare.ts')).toContain('missing')
    })

    it('accepts the exact header and ignores files outside a src tree', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v =>
                ['/headed.ts', '/outside.ts'].some(n => v.file.endsWith(n)),
            ),
        ).toEqual([])
    })

    it('prepends a missing header and replaces a stale one under --fix', async () => {
        await withScratch(
            {
                'apps/demo/src/bare.ts': 'export const bare = 1\n',
                'apps/demo/src/stale.ts':
                    '/*\n Copyright 2020 Someone\n */\n\nexport const stale = 1\n',
                'apps/demo/src/empty.ts': '',
            },
            async dir => {
                const runner = await createRunner(RULE, `${dir}/**/*.ts`)
                try {
                    await runner.fix()
                    const read = (name: string) =>
                        readFile(
                            join(REPO_ROOT, dir, 'apps/demo/src', name),
                            'utf8',
                        )

                    expect(await read('bare.ts')).toBe(
                        `${COPYRIGHT_HEADER}\n\nexport const bare = 1\n`,
                    )
                    expect(await read('stale.ts')).toBe(
                        `${COPYRIGHT_HEADER}\n\nexport const stale = 1\n`,
                    )
                    expect(await read('empty.ts')).toMatch(
                        new RegExp(
                            `^${COPYRIGHT_HEADER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
                        ),
                    )
                    expect(await runner.run()).toEqual([])
                } finally {
                    await runner.dispose()
                }
            },
        )
    })

    it('leaves a leading-whitespace file alone under --fix and reports why', async () => {
        await withScratch(
            {
                'apps/demo/src/lead.ts': '\nexport const lead = 1\n',
            },
            async dir => {
                const runner = await createRunner(RULE, `${dir}/**/*.ts`)
                try {
                    await runner.fix()
                    const content = await readFile(
                        join(REPO_ROOT, dir, 'apps/demo/src/lead.ts'),
                        'utf8',
                    )
                    expect(content).toBe('\nexport const lead = 1\n')

                    const found = await runner.run()
                    expect(found).toHaveLength(1)
                    expect(found[0]?.message).toContain('leading blank space')
                } finally {
                    await runner.dispose()
                }
            },
        )
    })
})
