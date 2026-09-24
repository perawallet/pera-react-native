/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    PLURAL_SUFFIXES,
    jsonLocation,
    keyLines,
    leafKeys,
    pluralBase,
} from '../shared/locale.js'
import { resolveRelative } from '../shared/paths.js'

const nameOf = (path: string): string => path.split('/').pop() ?? path

export default defineRule({
    id: 'pera/locale-key-parity',
    severity: 'error',
    card: {
        message: 'a locale bundle does not mirror en.json',
        remediation:
            'Give the locale exactly the keys en.json has: add the missing ones, translated, and delete the extra ones. A plural variant en.json has no category for (e.g. `_zero`) is allowed only where en.json pluralises the same base. See docs/I18N_TRANSLATION_GUIDE.md.',
        examples: {
            bad: 'en.json has "common.ok" and de.json does not',
            good: 'de.json has every en.json key and nothing else',
        },
    },
    gates: { pathMatches: ['**/apps/mobile/src/i18n/locales.ts'] },
    query: `
        ((import_statement source: (string (string_fragment) @source))
         (#match? @source "^[.]/locales/[^/]+[.]json$"))
    `,
    check(ctx, m) {
        const source = m.source
        if (source === undefined) return
        const specifier = ctx.text(source)
        if (specifier === undefined) return

        const localePath = resolveRelative(ctx.filePath, specifier)
        const enPath = resolveRelative(ctx.filePath, './locales/en.json')
        if (localePath === enPath) return
        const localeRaw = ctx.readFile(localePath)
        const enRaw = ctx.readFile(enPath)
        if (localeRaw === undefined || enRaw === undefined) return

        const en = leafKeys(enRaw)
        const locale = leafKeys(localeRaw)
        const enLines = keyLines(enRaw)
        const localeLines = keyLines(localeRaw)

        for (const key of en) {
            if (locale.has(key)) continue
            ctx.emitFact({
                kind: 'missing',
                key,
                locale: localePath,
                json: enPath,
                jsonLine: enLines.get(key) ?? 1,
            })
        }
        // How many plural forms a language has is CLDR's call, not English's:
        // pt-BR needs a `_zero`. An extra variant is fine when en pluralises
        // the same base.
        for (const key of locale) {
            if (en.has(key)) continue
            const base = pluralBase(key)
            if (
                base !== undefined &&
                PLURAL_SUFFIXES.some(s => en.has(`${base}${s}`))
            ) {
                continue
            }
            ctx.emitFact({
                kind: 'extra',
                key,
                locale: localePath,
                json: localePath,
                jsonLine: localeLines.get(key) ?? 1,
            })
        }
    },
    reduce(ctx) {
        for (const fact of ctx.facts('missing')) {
            ctx.report(
                jsonLocation(fact),
                `"${String(fact.key)}" is in en.json but missing from ${nameOf(String(fact.locale))}`,
            )
        }
        for (const fact of ctx.facts('extra')) {
            ctx.report(
                jsonLocation(fact),
                `"${String(fact.key)}" is in ${nameOf(String(fact.locale))} but not in en.json`,
            )
        }
    },
})
