/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import {
    createRunner,
    locations,
    withScratch,
    type Violation,
} from './helpers.js'

const RULE = 'lanekeep/rules/spec-imports-own-src.ts'

const manifest = (name: string): string => JSON.stringify({ name }, null, 4)

const SELFIE_CONFIG = [
    "import path from 'path'",
    'export default {',
    '    resolve: {',
    '        alias: {',
    "            '@perawallet/selfie/aliased': path.resolve(__dirname, 'src/aliased.ts'),",
    "            '@perawallet/selfie/elsewhere': path.resolve(",
    '                __dirname,',
    "                '../other/src/index.ts',",
    '            ),',
    '        },',
    '    },',
    '}',
    '',
].join('\n')

const SELFIE = 'packages/selfie/src/__tests__'

const FILES: Record<string, string> = {
    'packages/selfie/package.json': manifest('@perawallet/selfie'),
    'packages/selfie/vitest.config.ts': SELFIE_CONFIG,
    [`${SELFIE}/barrel.spec.ts`]: "import { a } from '@perawallet/selfie'\n",
    [`${SELFIE}/subpath.spec.ts`]:
        "import { a } from '@perawallet/selfie/native'\n",
    [`${SELFIE}/type-only.spec.ts`]:
        "import type { C } from '@perawallet/selfie'\n",
    [`${SELFIE}/loaders.spec.ts`]: [
        "const m = await import('@perawallet/selfie')",
        "const real = await vi.importActual('@perawallet/selfie')",
        '',
    ].join('\n'),
    [`${SELFIE}/elsewhere.spec.ts`]:
        "import { a } from '@perawallet/selfie/elsewhere'\n",
    [`${SELFIE}/deep-alias.spec.ts`]:
        "import { a } from '@perawallet/selfie/aliased/deep'\n",
    [`${SELFIE}/helpers.ts`]: "export { a } from '@perawallet/selfie'\n",
    [`${SELFIE}/aliased.spec.ts`]:
        "import { a } from '@perawallet/selfie/aliased'\n",
    [`${SELFIE}/relative.spec.ts`]: "import { a } from '../index'\n",
    [`${SELFIE}/neighbour.spec.ts`]: "import { a } from '@perawallet/other'\n",
    [`${SELFIE}/lookalike.spec.ts`]:
        "import { a } from '@perawallet/selfie-extras'\n",
    'packages/bare/package.json': manifest('@perawallet/bare'),
    'packages/bare/src/__tests__/bare.spec.ts':
        "import { a } from '@perawallet/bare'\n",
    'extensions/plug/package.json': manifest('@perawallet/plug'),
    'extensions/plug/src/__tests__/plug.spec.ts':
        "import { a } from '@perawallet/plug'\n",
    'apps/appy/package.json': manifest('@perawallet/appy'),
    'apps/appy/src/__tests__/appy.spec.ts':
        "import { a } from '@perawallet/appy'\n",
}

const check = async (files: Record<string, string>): Promise<Violation[]> =>
    withScratch(files, async dir => {
        const runner = await createRunner(RULE, `${dir}/**/*.ts`)
        try {
            return await runner.run()
        } finally {
            await runner.dispose()
        }
    })

describe('pera/spec-imports-own-src', () => {
    it('reports own-name imports in package and extension test code unless an exact alias points into its src', async () => {
        const found = await check(FILES)

        expect(locations(found)).toEqual([
            'plug.spec.ts:1',
            'bare.spec.ts:1',
            'barrel.spec.ts:1',
            'deep-alias.spec.ts:1',
            'elsewhere.spec.ts:1',
            'helpers.ts:1',
            'loaders.spec.ts:1',
            'loaders.spec.ts:2',
            'subpath.spec.ts:1',
            'type-only.spec.ts:1',
        ])
        expect(new Set(found.map(v => v.ruleId))).toEqual(
            new Set(['pera/spec-imports-own-src']),
        )
    })

    it('names the specifier and the package in the message', async () => {
        const found = await check(FILES)

        expect(
            found.find(v => v.file.endsWith('barrel.spec.ts'))?.message,
        ).toBe(
            "'@perawallet/selfie' is @perawallet/selfie itself and resolves to its dist; import from src relatively, or alias '@perawallet/selfie' to src in vitest.config.ts",
        )
    })
})
