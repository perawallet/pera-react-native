/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/spec-file-suffix.ts'

// Parses with an ERROR root: a callback's `typeof import(…)` generic followed
// by another top-level statement.
const ERROR_ROOT = [
    "hoist('a', async importOriginal => {",
    '    const actual =',
    "        await importOriginal<typeof import('some-quite-long-package-name')>()",
    '})',
    '',
    'export const after = 1',
    '',
].join('\n')

describe('pera/spec-file-suffix', () => {
    it('reports every .test source suffix and leaves .spec files and look-alikes alone', async () => {
        await withScratch(
            {
                'packages/demo/src/__tests__/a.test.ts': 'export const a = 1\n',
                'packages/demo/src/__tests__/b.test.tsx':
                    'export const b = 1\n',
                'apps/demo/src/c.test.js': 'export const c = 1\n',
                'tools/d.test.mjs': 'export const d = 1\n',
                'packages/demo/src/__tests__/errorRoot.test.ts': ERROR_ROOT,
                'packages/demo/src/__tests__/e.spec.ts': 'export const e = 1\n',
                'packages/demo/src/test-utils/latest.ts':
                    'export const f = 1\n',
                'packages/demo/src/test.ts': 'export const g = 1\n',
            },
            async dir => {
                const runner = await createRunner(
                    RULE,
                    `${dir}/**/*.{ts,tsx,js,mjs}`,
                )
                try {
                    const found = await runner.run()
                    expect(
                        found.map(v => v.file.split('/').pop()).sort(),
                    ).toEqual([
                        'a.test.ts',
                        'b.test.tsx',
                        'c.test.js',
                        'd.test.mjs',
                        'errorRoot.test.ts',
                    ])
                } finally {
                    await runner.dispose()
                }
            },
        )
    })
})
