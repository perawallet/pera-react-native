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
    preferNullableAlias,
    NULLABLE_ALIAS_EXCLUDED_PATHS,
} from '../rules/prefer-nullable-alias.js'
import { overridesWith, readOxlintConfig } from './helpers.js'

RuleTester.describe = describe
RuleTester.it = it

const S = '@perawallet/wallet-core-shared'
const RULE = 'pera/prefer-nullable-alias'
const REPO_ROOT = join(__dirname, '../../../..')
const TEST_SUPPORT_EXCLUDES = [
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/test-utils/**',
    '**/__integration__/**',
    '**/*.spec.{ts,tsx}',
    '**/*.test.{ts,tsx}',
]

const tester = new RuleTester({
    languageOptions: { sourceType: 'module', parserOptions: { lang: 'ts' } },
})

tester.run(RULE, preferNullableAlias, {
    valid: [
        'type A = Nullable<string>',
        'type A = string | number | null',
        'type A = null | undefined',
        'type A = string | void',
        'type A = readonly string[] | null',
        'type A = readonly [string, number] | undefined',
        'type A = { a?: string }',
        'function f(a?: string) {}',
        { code: 'type A = string | null', filename: 'globals.d.ts' },
    ],
    invalid: [
        {
            code: `import type { Foo } from '${S}'\ntype A = string | null`,
            output: `import type { Foo, Nullable } from '${S}'\ntype A = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Nullable } from '${S}'\ntype A = null | string`,
            output: `import type { Nullable } from '${S}'\ntype A = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import { logger } from '${S}'\nconst f = (a: string | undefined) => a`,
            output: `import { logger, type Optional } from '${S}'\nconst f = (a: Optional<string>) => a`,
            errors: [{ messageId: 'optional' }],
        },
        {
            code: `import { type Foo } from '${S}'\ntype A = string | null | undefined`,
            output: `import { type Foo, type Maybe } from '${S}'\ntype A = Maybe<string>`,
            errors: [{ messageId: 'maybe' }],
        },
        {
            code: `import type { Maybe } from '${S}'\ntype A = undefined | Foo | null`,
            output: `import type { Maybe } from '${S}'\ntype A = Maybe<Foo>`,
            errors: [{ messageId: 'maybe' }],
        },
        {
            code: `import type { A } from '${S}'\nimport { b } from '${S}'\ntype T = string | null`,
            output: `import type { A, Nullable } from '${S}'\nimport { b } from '${S}'\ntype T = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import { z } from 'zod'\ntype A = string | null`,
            output: `import { z } from 'zod'\nimport type { Nullable } from '${S}'\ntype A = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import { z } from '@perawallet/wallet-core-accounts'\nimport { x } from './x'\ntype A = string | null`,
            output: `import { z } from '@perawallet/wallet-core-accounts'\nimport type { Nullable } from '${S}'\nimport { x } from './x'\ntype A = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import { x } from './x'\ntype A = string | null`,
            output: `import type { Nullable } from '${S}'\nimport { x } from './x'\ntype A = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: 'type A = string | null',
            output: `import type { Nullable } from '${S}'\n\ntype A = Nullable<string>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Nullable } from '${S}'\ntype A = (() => void) | null`,
            output: `import type { Nullable } from '${S}'\ntype A = Nullable<() => void>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Nullable } from '${S}'\ntype A =\n    | Foo\n    | null`,
            output: `import type { Nullable } from '${S}'\ntype A =\n    Nullable<Foo>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Nullable } from '${S}'\nconst [s] = useState<string | null>(null)`,
            output: `import type { Nullable } from '${S}'\nconst [s] = useState<Nullable<string>>(null)`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Nullable } from '${S}'\ntype A = { a?: string | null }`,
            output: `import type { Nullable } from '${S}'\ntype A = { a?: Nullable<string> }`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Nullable } from '${S}'\ntype A = { /** doc */ a: string } | null`,
            output: `import type { Nullable } from '${S}'\ntype A = Nullable<{ /** doc */ a: string }>`,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: `import type { Optional, Nullable } from '${S}'\ntype A = Array<string | null> | undefined`,
            output: `import type { Optional, Nullable } from '${S}'\ntype A = Optional<Array<Nullable<string>>>`,
            recursive: 1,
            errors: [{ messageId: 'optional' }, { messageId: 'nullable' }],
        },
        {
            code: `import type { Foo } from '${S}'\ntype A = string | undefined\ntype B = number | null`,
            output: `import type { Foo, Optional, Nullable } from '${S}'\ntype A = Optional<string>\ntype B = Nullable<number>`,
            recursive: 1,
            errors: [{ messageId: 'optional' }, { messageId: 'nullable' }],
        },
        {
            code: 'type Nullable<T> = T | 0\ntype A = string | null',
            output: null,
            errors: [{ messageId: 'nullable' }],
        },
        {
            code: 'function f<Optional>(a: string | undefined) {}',
            output: null,
            errors: [{ messageId: 'optional' }],
        },
        {
            code: `import type { Optional } from './types'\ntype A = string | undefined`,
            output: null,
            errors: [{ messageId: 'optional' }],
        },
        {
            code: `import type { Nullable } from '${S}'\ntype A = string | /* unset */ null`,
            output: null,
            errors: [{ messageId: 'nullable' }],
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
        expect(overrides[0].excludeFiles).toEqual([
            ...TEST_SUPPORT_EXCLUDES,
            ...NULLABLE_ALIAS_EXCLUDED_PATHS,
        ])
    })

    it('excludes only paths that exist', () => {
        for (const path of NULLABLE_ALIAS_EXCLUDED_PATHS) {
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
