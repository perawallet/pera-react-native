/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { EN_JSON, flattenLocale, isStringLeaf } from '../shared/locale.js'

export default defineRule({
    id: 'pera/error-message-key-exists',
    severity: 'error',
    card: {
        message: 'messageKey does not resolve to a string in en.json',
        remediation:
            'Point messageKey at an existing string in apps/mobile/src/i18n/locales/en.json, or add the copy. A key naming an object will not render.',
        examples: {
            bad: "{ messageKey: 'common' }",
            good: "{ messageKey: 'common.back_online' }",
        },
    },
    gates: { fileContains: ['messageKey'] },
    // Only a string-literal value is statically resolvable. Shorthand
    // `{ messageKey }` has no value node to read, and a variable or template
    // literal cannot be resolved syntactically; the runtime missingKeyHandler
    // covers both.
    query: `
        (pair
          key: (_) @key
          value: (string (string_fragment) @value) @str
          (#any-of? @key "messageKey" "\\"messageKey\\"" "'messageKey'"))
    `,
    check(ctx, m) {
        const value = m.value
        const str = m.str
        if (value === undefined || str === undefined) return
        const key = ctx.text(value)
        if (key === undefined) return

        const raw = ctx.readFile(EN_JSON)
        if (raw === undefined) return
        if (isStringLeaf(flattenLocale(raw), key)) return

        ctx.report(str, `messageKey "${key}" is not a string in en.json`)
    },
})
