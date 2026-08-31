/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'
import { EN_JSON, flattenLocale } from '../shared/locale.js'

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g

const unquote = (raw: string): string => raw.replace(/^['"]|['"]$/g, '')

function pairKey(ctx: RuleContext, pair: Node): string | undefined {
    const [key] = ctx.namedChildren(pair)
    if (key === undefined) return undefined
    const raw = ctx.text(key)
    return raw === undefined ? undefined : unquote(raw)
}

/**
 * `undefined` means the params are present but not statically readable — a
 * shorthand reference or a spread. That is a distinct violation from "no
 * params declared": here a value might genuinely be supplied at runtime, but
 * nothing can confirm it, so the caller reports it as unverified rather than
 * as definitely missing.
 */
function readParamNames(
    ctx: RuleContext,
    container: Node,
): string[] | undefined {
    const props = ctx.namedChildren(container)

    // A spread could supply `params` even though no property is written here.
    if (props.some(p => ctx.kind(p) === 'spread_element')) return undefined
    // `{ params }` shorthand has no value node to read.
    if (
        props.some(
            p =>
                ctx.kind(p) === 'shorthand_property_identifier' &&
                ctx.text(p) === 'params',
        )
    ) {
        return undefined
    }

    const paramsPair = props.find(
        p => ctx.kind(p) === 'pair' && pairKey(ctx, p) === 'params',
    )
    if (paramsPair === undefined) return []

    const [, value] = ctx.namedChildren(paramsPair)
    if (value === undefined || ctx.kind(value) !== 'object') return undefined
    if (ctx.namedChildren(value).some(p => ctx.kind(p) === 'spread_element')) {
        return undefined
    }

    const names: string[] = []
    for (const prop of ctx.namedChildren(value)) {
        const kind = ctx.kind(prop)
        if (kind === 'shorthand_property_identifier') {
            const raw = ctx.text(prop)
            if (raw !== undefined) names.push(raw)
            continue
        }
        if (kind !== 'pair') continue
        const name = pairKey(ctx, prop)
        if (name !== undefined) names.push(name)
    }
    return names
}

export default defineRule({
    id: 'pera/error-params-match-copy',
    severity: 'error',
    card: {
        message: 'copy placeholder has no matching param',
        remediation:
            'Add a params entry for every {{placeholder}} in the copy, or remove the placeholder. When params is a shorthand reference or a spread, restructure it to a plain object literal so it can be checked, or suppress once with a reason. Extra params without a matching placeholder are fine — they serve as log context.',
        examples: {
            bad: "{ messageKey: 'greet', params: {} } // copy is 'Hi {{name}}'",
            good: "{ messageKey: 'greet', params: { name } }",
        },
    },
    gates: { fileContains: ['messageKey'] },
    query: `
        (pair
          key: (_) @key
          value: (string (string_fragment) @value)) @pair
    `,
    check(ctx, m) {
        const pair = m.pair
        const key = m.key
        const value = m.value
        if (pair === undefined || key === undefined || value === undefined) {
            return
        }
        const keyName = ctx.text(key)
        if (keyName === undefined || unquote(keyName) !== 'messageKey') return

        const container = ctx.parent(pair)
        if (container === undefined || ctx.kind(container) !== 'object') return

        const messageKey = ctx.text(value)
        if (messageKey === undefined) return
        const raw = ctx.readFile(EN_JSON)
        if (raw === undefined) return
        const copy = flattenLocale(raw)[messageKey]
        if (copy === undefined) return // error-message-key-exists owns this case

        const placeholders = [...copy.matchAll(PLACEHOLDER_RE)].map(
            ([, name]) => name,
        )
        if (placeholders.length === 0) return

        const declared = readParamNames(ctx, container)
        if (declared === undefined) {
            ctx.report(
                pair,
                `params for "${messageKey}" can't be read statically here, so {{${placeholders.join('}}, {{')}}} can't be confirmed as supplied`,
            )
            return
        }

        const missing = placeholders.filter(p => !declared.includes(p))
        if (missing.length === 0) return

        ctx.report(
            pair,
            `copy for "${messageKey}" uses {{${missing.join('}}, {{')}}} with no matching param`,
        )
    },
})
