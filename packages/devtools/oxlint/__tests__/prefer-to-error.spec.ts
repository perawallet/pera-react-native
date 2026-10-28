/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RuleTester } from 'oxlint/plugins-dev'
import {
    preferToError,
    TO_ERROR_EXCLUDED_PATHS,
} from '../rules/prefer-to-error.js'
import { overridesWith, readOxlintConfig } from './helpers.js'

RuleTester.describe = describe
RuleTester.it = it

const S = '@perawallet/wallet-core-shared'
const RULE = 'pera/prefer-to-error'
const REPO_ROOT = join(__dirname, '../../../..')

const tester = new RuleTester({
    languageOptions: { sourceType: 'module', parserOptions: { lang: 'ts' } },
})

tester.run(RULE, preferToError, {
    valid: [
        'const m = e instanceof Error ? e : undefined',
        "const m = e instanceof Error ? e.message : 'unknown error'",
        'const m = e instanceof Error ? e : new Error(e)',
        'const m = e instanceof Error ? e : String(e)',
        'const m = e instanceof Error ? e.stack : undefined',
        'const m = e instanceof Error ? e : new Error(String(e), { cause: e })',
        'const m = e instanceof Error ? f : new Error(String(e))',
        'const m = e instanceof TypeError ? e : new Error(String(e))',
        'const m = e instanceof Error ? e.message : `${e}`',
        'const m = f() instanceof Error ? f() : new Error(String(f()))',
        'const m = e[0] instanceof Error ? e[0] : new Error(String(e[0]))',
        'const m = e?.err instanceof Error ? e?.err : new Error(String(e?.err))',
        'class Error {}\nconst m = e instanceof Error ? e : new Error(String(e))',
        `import { String } from './s'\nconst m = e instanceof Error ? e.message : String(e)`,
    ],
    invalid: [
        {
            code: `import { logger } from '${S}'\nconst m = e instanceof Error ? e : new Error(String(e))`,
            output: `import { logger, toError } from '${S}'\nconst m = toError(e)`,
            errors: [{ messageId: 'error' }],
        },
        {
            code: `import {\n    logger,\n} from '${S}'\nconst m = e instanceof Error ? e.message : String(e)`,
            output: `import {\n    logger, toError,\n} from '${S}'\nconst m = toError(e).message`,
            errors: [{ messageId: 'message' }],
        },
        {
            code: `import { useQuery } from '@perawallet/wallet-core-accounts'\nimport { x } from './x'\nconst m = query.error instanceof Error ? query.error.message : String(query.error)`,
            output: `import { useQuery } from '@perawallet/wallet-core-accounts'\nimport { toError } from '${S}'\nimport { x } from './x'\nconst m = toError(query.error).message`,
            errors: [{ messageId: 'message' }],
        },
        {
            code: `import { z } from 'zod'\n// local helper\nimport { x } from './x'\nconst m = e instanceof Error ? e : new Error(String(e))`,
            output: `import { z } from 'zod'\nimport { toError } from '${S}'\n// local helper\nimport { x } from './x'\nconst m = toError(e)`,
            errors: [{ messageId: 'error' }],
        },
        {
            code: `import { x } from './x'\nconst m = e instanceof Error ? e : new Error(String(e))`,
            output: `import { toError } from '${S}'\nimport { x } from './x'\nconst m = toError(e)`,
            errors: [{ messageId: 'error' }],
        },
        {
            code: `import { z } from 'zod'\nconst m = e instanceof Error ? e.message : String(e)`,
            output: `import { z } from 'zod'\nimport { toError } from '${S}'\nconst m = toError(e).message`,
            errors: [{ messageId: 'message' }],
        },
        {
            code: `import type { T } from '${S}'\nconst m = e instanceof Error ? e : new Error(String(e))`,
            output: `import type { T } from '${S}'\nimport { toError } from '${S}'\nconst m = toError(e)`,
            errors: [{ messageId: 'error' }],
        },
        {
            code: `import { toError } from '${S}'\nconst m = err instanceof Error ? err.message : String(err)`,
            output: `import { toError } from '${S}'\nconst m = toError(err).message`,
            errors: [{ messageId: 'message' }],
        },
        {
            code: 'const toError = (v: unknown): Error => v instanceof Error ? v : new Error(String(v))',
            output: null,
            errors: [{ messageId: 'error' }],
        },
        {
            code: `import { toError } from '${S}'\nconst f = (toError: unknown) => toError instanceof Error ? toError.message : String(toError)`,
            output: null,
            errors: [{ messageId: 'message' }],
        },
        {
            code: 'const m = e instanceof Error ? e.message : String(e)',
            output: `import { toError } from '${S}'\n\nconst m = toError(e).message`,
            errors: [{ messageId: 'message' }],
        },
        {
            code: `import { logger } from '${S}'\nconst a = x instanceof Error ? x : new Error(String(x))\nconst b = y instanceof Error ? y.message : String(y)`,
            output: `import { logger, toError } from '${S}'\nconst a = toError(x)\nconst b = toError(y).message`,
            recursive: 1,
            errors: [{ messageId: 'error' }, { messageId: 'message' }],
        },
        {
            code: `import { type Foo, logger } from '${S}'\nconst m = \`failed: \${e instanceof Error ? e.message : String(e)}\``,
            output: `import { type Foo, logger, toError } from '${S}'\nconst m = \`failed: \${toError(e).message}\``,
            errors: [{ messageId: 'message' }],
        },
        {
            code: `import { logger } from '${S}'\nclass A { run() { return this.err instanceof Error ? this.err.message : String(this.err) } }`,
            output: `import { logger, toError } from '${S}'\nclass A { run() { return toError(this.err).message } }`,
            errors: [{ messageId: 'message' }],
        },
    ],
})

describe(RULE, () => {
    it('is enabled as an error for source in the root config, outside the excluded paths', () => {
        const root = readOxlintConfig('.oxlintrc.json')

        const overrides = overridesWith(root, RULE)

        expect(overrides).toHaveLength(1)
        expect(overrides[0].rules[RULE]).toBe('error')
        expect(overrides[0].files).toEqual([
            'apps/*/src/**',
            'packages/*/src/**',
            'extensions/*/src/**',
        ])
        expect(overrides[0].excludeFiles).toEqual(
            expect.arrayContaining(TO_ERROR_EXCLUDED_PATHS),
        )
    })

    it('excludes only paths that exist', () => {
        for (const path of TO_ERROR_EXCLUDED_PATHS) {
            expect(
                existsSync(join(REPO_ROOT, path.replace(/\/\*\*$/, ''))),
            ).toBe(true)
        }
    })

    it('is enabled as an error for source in the mobile config', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')

        const overrides = overridesWith(mobile, RULE)

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual(['src/**'])
        expect(overrides[0].rules[RULE]).toBe('error')
    })
})
