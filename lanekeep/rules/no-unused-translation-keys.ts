/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    jsonLocation,
    keyLines,
    leafKeys,
    pluralBase,
} from '../shared/locale.js'
import { resolveRelative } from '../shared/paths.js'
import { productionSource } from '../shared/scope.js'

// Built at run time from transaction enums (`transactions.type.${tx.type}`)
// that no template head or literal path reaches. Never an escape hatch for
// errors.*: an unclaimed error key is exactly the drift this rule stops.
const EXCLUDED_KEYS = new Set([
    'transactions.common.completed',
    'transactions.common.failed',
    'transactions.common.pending',
    'transactions.type.pay',
    'transactions.type.keyreg',
    'transactions.type.acfg',
    'transactions.type.axfer',
    'transactions.type.afrz',
    'transactions.type.appl',
    'transactions.type.stpf',
    'transactions.type.hb',
    'transactions.type.unknown',
])

// A literal that could name a key: dotted, word characters and hyphens.
const KEY_SHAPED = /^[A-Za-z][\w-]*(?:\.[\w-]+)+$/
// A literal naming a key path claims the keys under it, e.g. an i18nBaseKey
// completed at run time. Word characters only: hosts and package names are
// dotted and hyphenated, and keeping hyphens out of ancestor claims stops
// them claiming a key subtree.
const PATH_SHAPED = /^[A-Za-z]\w*(?:\.\w+)+$/
// `errors.algod.${code}` and `networks_${chain}` build keys from a head.
const TEMPLATE_HEAD = /^`([A-Za-z][\w.]*[._])\$\{/

export default defineRule({
    id: 'pera/no-unused-translation-keys',
    severity: 'error',
    card: {
        message: 'an en.json key is never used',
        remediation:
            'Delete the key from en.json and every other locale, or use it. A key built at run time is claimed by a template head (`errors.${code}`) or a literal naming its parent path; only non-error keys assembled from enums belong in EXCLUDED_KEYS in this rule.',
        examples: {
            bad: '"settings.old_banner" in en.json, referenced nowhere',
            good: "t('settings.old_banner') in the screen that shows it",
        },
    },
    gates: productionSource(),
    query: `
        ((import_statement source: (string (string_fragment) @enSource))
         (#match? @enSource "^[.]/locales/en[.]json$"))
        ((string (string_fragment) @literal)
         (#match? @literal "^[A-Za-z][A-Za-z0-9_-]*([.][A-Za-z0-9_-]+)+$"))
        ((template_string) @template
         (#match? @template "^.[A-Za-z]"))
    `,
    check(ctx, m) {
        if (m.enSource !== undefined) {
            const enPath = resolveRelative(
                ctx.filePath,
                ctx.text(m.enSource) ?? '',
            )
            const raw = ctx.readFile(enPath)
            if (raw === undefined) return
            const lines = keyLines(raw)
            for (const key of leafKeys(raw)) {
                ctx.emitFact({
                    kind: 'key',
                    key,
                    json: enPath,
                    jsonLine: lines.get(key) ?? 1,
                })
            }
            return
        }
        if (m.literal !== undefined) {
            const value = ctx.text(m.literal)
            if (value !== undefined) ctx.emitFact({ kind: 'literal', value })
            return
        }
        if (m.template === undefined) return
        const text = ctx.text(m.template)
        if (text === undefined) return
        const head = TEMPLATE_HEAD.exec(text)
        if (head !== null) {
            ctx.emitFact({ kind: 'head', value: head[1] })
            return
        }
        const inner = text.slice(1, -1)
        if (!inner.includes('${') && KEY_SHAPED.test(inner)) {
            ctx.emitFact({ kind: 'literal', value: inner })
        }
    },
    reduce(ctx) {
        const literals = new Set(ctx.facts('literal').map(f => String(f.value)))
        const heads = [...new Set(ctx.facts('head').map(f => String(f.value)))]
        const claimedByAncestor = (key: string): boolean => {
            const segments = key.split('.')
            for (let i = segments.length - 1; i > 0; i--) {
                const ancestor = segments.slice(0, i).join('.')
                if (PATH_SHAPED.test(ancestor) && literals.has(ancestor)) {
                    return true
                }
            }
            return false
        }

        for (const fact of ctx.facts('key')) {
            const key = String(fact.key)
            if (
                literals.has(key) ||
                heads.some(head => key.startsWith(head)) ||
                claimedByAncestor(key)
            ) {
                continue
            }
            if (key.startsWith('errors.')) {
                ctx.report(
                    jsonLocation(fact),
                    `error key "${key}" is not claimed by a messageKey, a keysFor() base or a t() call`,
                )
                continue
            }
            const base = pluralBase(key)
            if (base !== undefined && literals.has(base)) continue
            if (EXCLUDED_KEYS.has(key)) continue
            ctx.report(jsonLocation(fact), `"${key}" is not used anywhere`)
        }
    },
})
