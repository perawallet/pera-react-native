/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { EN_JSON, flattenLocale, isStringLeaf } from '../shared/locale.js'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

export default defineRule({
    id: 'pera/i18n-key-exists',
    severity: 'error',
    card: {
        message:
            'i18nKey() must take one string literal that names a string in en.json',
        remediation:
            "Spell the whole key as a literal, and point it at an existing string in apps/mobile/src/i18n/locales/en.json, or add the copy to en.json and every other locale. A key naming an object does not render; a plural key is accepted by its base. A key that varies becomes one i18nKey('...') per value, in a literal map.",
        examples: {
            bad: 'i18nKey(`errors.${code}.title`)',
            good: "i18nKey('errors.general.title')",
        },
    },
    gates: productionSource({
        fileContains: ['i18nKey('],
        pathNotMatches: [...TEST_SUPPORT],
    }),
    query: `
        ((call_expression
           function: (identifier) @fn
           arguments: (arguments) @args) @call
         (#eq? @fn "i18nKey"))
    `,
    check(ctx, m) {
        const call = m.call
        const args = m.args
        if (call === undefined || args === undefined) return

        const [arg, ...rest] = ctx.namedChildren(args)
        const kind = arg === undefined ? undefined : ctx.kind(arg)
        const text = arg === undefined ? undefined : ctx.text(arg)
        const isLiteral =
            text !== undefined &&
            rest.length === 0 &&
            (kind === 'string' ||
                (kind === 'template_string' && !text.includes('${')))
        if (!isLiteral || arg === undefined) {
            ctx.report(
                call,
                'i18nKey() takes one string literal; spell the whole key here',
            )
            return
        }

        const key = text.slice(1, -1)
        const raw = ctx.readFile(EN_JSON)
        if (raw === undefined) return
        const flat = flattenLocale(raw)
        if (
            isStringLeaf(flat, key) ||
            isStringLeaf(flat, `${key}_one`) ||
            isStringLeaf(flat, `${key}_other`)
        ) {
            return
        }
        ctx.report(arg, `"${key}" is not a string in en.json`)
    },
})
