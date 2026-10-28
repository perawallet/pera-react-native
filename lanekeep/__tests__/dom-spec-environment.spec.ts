/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, locations, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/dom-spec-environment.ts'

const NODE_CONFIG = "export default { test: { environment: 'node' } }\n"
const JSDOM_CONFIG = "export default { test: { environment: 'jsdom' } }\n"
const RENDERS = "import { renderHook } from '@testing-library/react'\n"

describe('pera/dom-spec-environment', () => {
    it('reports a rendering import only where the workspace runs node and the spec has no pragma', async () => {
        const found = await withScratch(
            {
                'packages/node/vitest.config.ts': NODE_CONFIG,
                'packages/node/src/__tests__/renders.spec.ts': RENDERS,
                'packages/node/src/__tests__/pragma.spec.ts': `// @vitest-environment jsdom\n${RENDERS}`,
                'packages/node/src/__tests__/act.spec.ts':
                    "import { act, waitFor } from '@testing-library/react'\n",
                'packages/node/src/__tests__/helper.ts': RENDERS,
                'packages/dom/vitest.config.ts': JSDOM_CONFIG,
                'packages/dom/src/__tests__/renders.spec.ts': RENDERS,
                'packages/bare/vitest.config.ts': 'export default {}\n',
                'packages/bare/src/__tests__/default-env.spec.ts': RENDERS,
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

        expect(locations(found)).toEqual([
            'default-env.spec.ts:1',
            'renders.spec.ts:1',
        ])
        expect(
            found.map(v => v.file.split('/').slice(-5, -3).join('/')),
        ).toEqual(['packages/bare', 'packages/node'])
    })
})
