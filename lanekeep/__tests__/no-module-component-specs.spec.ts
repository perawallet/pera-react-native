/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, locations, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/no-module-component-specs.ts'
const MODULE = 'apps/mobile/src/modules/demo'

const SPEC = [
    '/*',
    ' * header',
    ' */',
    '',
    "import { describe } from 'vitest'",
    '',
    "describe('Demo', () => {})",
    "describe('Again', () => {})",
    '',
].join('\n')

// Split so lanekeep doesn't read the directive in this file as its own.
const DIRECTIVE =
    '// lanekeep-ignore' +
    '-next-line pera/no-module-component-specs reason: asserts what the user sees before signing'

const KEPT = SPEC.replace("describe('Demo'", `${DIRECTIVE}\ndescribe('Demo'`)

describe('pera/no-module-component-specs', () => {
    it('reports PascalCase specs under modules at their first describe and leaves hooks, helpers, routes and other trees alone', async () => {
        await withScratch(
            {
                [`${MODULE}/screens/DemoScreen/__tests__/DemoScreen.spec.tsx`]:
                    SPEC,
                [`${MODULE}/components/DemoCard/__tests__/DemoCard.web.spec.tsx`]:
                    SPEC,
                [`${MODULE}/components/DemoCard/__tests__/DemoCard.spec.ts`]:
                    'export const c = 1\n',
                [`${MODULE}/components/KeptCard/__tests__/KeptCard.spec.tsx`]:
                    KEPT,
                [`${MODULE}/screens/DemoScreen/__tests__/useDemoScreen.spec.ts`]:
                    SPEC,
                [`${MODULE}/__tests__/registry.spec.tsx`]: SPEC,
                [`${MODULE}/routes/__tests__/DemoStackNavigator.spec.tsx`]:
                    SPEC,
                'apps/mobile/src/components/PWDemo/__tests__/PWDemo.spec.tsx':
                    SPEC,
            },
            async dir => {
                const runner = await createRunner(RULE, `${dir}/**/*.{ts,tsx}`)
                try {
                    expect(locations(await runner.run()).sort()).toEqual([
                        'DemoCard.spec.ts:1',
                        'DemoCard.web.spec.tsx:7',
                        'DemoScreen.spec.tsx:7',
                    ])
                } finally {
                    await runner.dispose()
                }
            },
        )
    })
})
