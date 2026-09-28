/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { flattenLocale, jsonLocation, keyLines } from '../shared/locale.js'
import { resolveRelative } from '../shared/paths.js'

// Turkish suffixes follow vowel harmony and consonant voicing, so a suffix on
// a {{placeholder}} is right for some values and wrong for others. The
// apostrophe forms are the same trap in the standard spelling.
const SUFFIX_AFTER_PLACEHOLDER = /\}\}['’]?\p{L}/u

export default defineRule({
    id: 'pera/locale-placeholder-suffix',
    severity: 'error',
    card: {
        message: 'a Turkish suffix is attached to a {{placeholder}}',
        remediation:
            'Reword so the placeholder stands alone, e.g. "{{name}} kişisine" rather than "{{name}}\'e": the right suffix depends on the value. See docs/I18N_TRANSLATION_GUIDE.md.',
        examples: {
            bad: '"{{name}}\'e gönder"',
            good: '"{{name}} kişisine gönder"',
        },
    },
    gates: { pathMatches: ['**/apps/mobile/src/i18n/locales.ts'] },
    query: `
        ((import_statement source: (string (string_fragment) @source))
         (#match? @source "^[.]/locales/tr[.]json$"))
    `,
    check(ctx, m) {
        const source = m.source
        if (source === undefined) return
        const specifier = ctx.text(source)
        if (specifier === undefined) return
        const trPath = resolveRelative(ctx.filePath, specifier)
        const raw = ctx.readFile(trPath)
        if (raw === undefined) return

        // keyLines walks the whole file against the 1 s per-file budget, so it
        // runs only once a finding needs a line.
        let lines: Map<string, number> | undefined
        for (const [key, value] of Object.entries(flattenLocale(raw))) {
            if (!SUFFIX_AFTER_PLACEHOLDER.test(value)) continue
            lines ??= keyLines(raw)
            ctx.emitFact({
                kind: 'suffix',
                key,
                json: trPath,
                jsonLine: lines.get(key) ?? 1,
            })
        }
    },
    reduce(ctx) {
        for (const fact of ctx.facts('suffix')) {
            ctx.report(
                jsonLocation(fact),
                `"${String(fact.key)}" attaches a suffix to a {{placeholder}}`,
            )
        }
    },
})
