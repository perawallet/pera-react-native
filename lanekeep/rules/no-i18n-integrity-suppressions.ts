/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

// A missing, extra or unused key has no legitimate exception, so these rules
// can't be suppressed. Naming this rule is refused too: otherwise a directive
// above a directive would silence it.
const GUARDED = [
    'locale-key-parity',
    'translation-key-exists',
    'no-unused-translation-keys',
    'no-i18n-integrity-suppressions',
].join('|')

export default defineRule({
    id: 'pera/no-i18n-integrity-suppressions',
    language: ['typescript', 'tsx', 'javascript'],
    severity: 'error',
    card: {
        message: 'an i18n integrity finding is suppressed',
        remediation:
            'Fix the key instead: add it to en.json and every locale, delete it, or use it. Missing, extra and unused keys have no legitimate exception.',
        // Neither example spells a directive: lanekeep scans raw bytes for
        // one, and this file is inside `include`.
        examples: {
            bad: 'an ignore directive naming pera/translation-key-exists',
            good: "t('common.back_online'), a key that exists",
        },
    },
    query: `((comment) @comment (#match? @comment "lanekeep-ignore.*pera/(${GUARDED})"))`,
    check(ctx, m) {
        if (m.comment === undefined) return
        ctx.report(m.comment)
    },
})
