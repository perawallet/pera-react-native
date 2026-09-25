/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { EN_JSON, leafKeys } from '../shared/locale.js'
import { productionSource } from '../shared/scope.js'

export default defineRule({
    id: 'pera/translation-key-exists',
    severity: 'error',
    card: {
        message: 't() names a key that is not in en.json',
        remediation:
            "Point t() at an existing key in apps/mobile/src/i18n/locales/en.json, or add the copy to en.json and every other locale. A key naming an object does not render; a plural key is looked up by its base, as t('items', { count }).",
        examples: {
            bad: "t('common.bak_online')",
            good: "t('common.back_online')",
        },
    },
    gates: productionSource(),
    // Only a literal first argument can be checked; an interpolated key is
    // skipped.
    query: `
        ((call_expression
           function: [(identifier) @fn (member_expression property: (property_identifier) @fn)]
           arguments: (arguments . [(string (string_fragment) @key) (template_string) @template]))
         (#eq? @fn "t"))
    `,
    check(ctx, m) {
        const node = m.key ?? m.template
        if (node === undefined) return
        const text = ctx.text(node)
        if (text === undefined) return
        let key = text
        if (m.template !== undefined) {
            if (text.includes('${')) return
            key = text.slice(1, -1)
        }

        const raw = ctx.readFile(EN_JSON)
        if (raw === undefined) return
        const keys = leafKeys(raw)
        if (
            keys.has(key) ||
            keys.has(`${key}_one`) ||
            keys.has(`${key}_other`)
        ) {
            return
        }
        ctx.report(node, `"${key}" is not a key in en.json`)
    },
})
