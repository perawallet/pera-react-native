/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import noAssertionlessTest from 'lanekeep/no-assertionless-test'
import { TEST_FILES } from '../shared/scope.js'

const builtIn = noAssertionlessTest({ tests: [...TEST_FILES] })

// The built-in names a test by its callee's receiver, so Playwright's
// `test.beforeAll(…)`, `test.describe(…)` and `test.step(…)` read as tests
// that assert nothing.
const NOT_A_TEST =
    /^(test|it)\.(beforeAll|afterAll|beforeEach|afterEach|describe|use|step)\b/

export default defineRule({
    ...builtIn,
    id: 'pera/no-assertionless-test',
    check(ctx, match) {
        const def = match.def
        if (def !== undefined && NOT_A_TEST.test(ctx.text(def) ?? '')) return
        builtIn.check?.(ctx, match)
    },
})
