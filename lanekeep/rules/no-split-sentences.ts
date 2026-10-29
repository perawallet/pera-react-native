/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { flattenLocale, jsonLocation, keyLines } from '../shared/locale.js'
import { resolveRelative } from '../shared/paths.js'

// Prefilled into the user's mail client: the trailing newline leaves the cursor on a blank line for their own text.
const TRAILING_NEWLINE_KEYS: ReadonlySet<string> = new Set([
    'peraCard.account.report_lost_email_body',
    'peraCard.transactions.report_email_body',
    'peraCard.transactions.report_transactions_email_body',
])

const isSplit = (key: string, value: string): boolean => {
    if (/^\s/u.test(value)) return true
    const tail = TRAILING_NEWLINE_KEYS.has(key)
        ? value.replace(/\n+$/u, '')
        : value
    return /\s$/u.test(tail)
}

export default defineRule({
    id: 'pera/no-split-sentences',
    severity: 'error',
    card: {
        message:
            'an en.json value starts or ends with whitespace, so it is half of a sentence',
        remediation:
            'Make the sentence one key and place the component with a numbered tag through <Trans>: "Powered by <0>P.E.R.A.</0>" when the translation supplies its text, "Balance: <0/>" when the component renders its own. Change every locale the same way. A value whose trailing newline is content goes in TRAILING_NEWLINE_KEYS with its reason. See docs/I18N_TRANSLATION_GUIDE.md.',
        examples: {
            bad: '"powered_by": "Powered by " rendered before a brand component',
            good: '"powered_by": "Powered by <0>P.E.R.A.</0>" rendered with <Trans>',
        },
    },
    gates: { pathMatches: ['**/apps/mobile/src/i18n/locales.ts'] },
    query: `
        ((import_statement source: (string (string_fragment) @source))
         (#match? @source "^[.]/locales/en[.]json$"))
    `,
    check(ctx, m) {
        const source = m.source
        if (source === undefined) return
        const specifier = ctx.text(source)
        if (specifier === undefined) return
        const enPath = resolveRelative(ctx.filePath, specifier)
        const raw = ctx.readFile(enPath)
        if (raw === undefined) return

        // keyLines walks the whole file against the 1 s per-file budget, so it
        // runs only once a finding needs a line.
        let lines: Map<string, number> | undefined
        for (const [key, value] of Object.entries(flattenLocale(raw))) {
            if (!isSplit(key, value)) continue
            lines ??= keyLines(raw)
            ctx.emitFact({
                kind: 'split',
                key,
                json: enPath,
                jsonLine: lines.get(key) ?? 1,
            })
        }
    },
    reduce(ctx) {
        for (const fact of ctx.facts('split')) {
            ctx.report(
                jsonLocation(fact),
                `"${String(fact.key)}" starts or ends with whitespace`,
            )
        }
    },
})
