/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Node, RuleContext } from 'lanekeep'

// Every token kind a raw-text scan of the file could see: names, comments and
// literal text. The predicate filters in Rust, so `check` runs on hits only.
const TOKEN_KINDS = [
    '(identifier)',
    '(property_identifier)',
    '(shorthand_property_identifier)',
    '(shorthand_property_identifier_pattern)',
    '(type_identifier)',
    '(private_property_identifier)',
    '(comment)',
    '(string)',
    '(template_string)',
    '(regex_pattern)',
]

// A tree-sitter query string literal unescapes `\\` and `\"`.
const asQueryString = (source: string): string =>
    source.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/** One query per grammar; JSX text exists only in tsx. */
export const referencesQuery = (
    pattern: RegExp,
): { typescript: string; tsx: string } => {
    // The prefilter runs `pattern.source` through tree-sitter's Rust regex
    // engine (Unicode-aware `\b`/`\d`, no JS regex flags reach it), so `check`
    // re-tests every candidate token with the real JS regex via ownText.
    // Flags such as `i` would silently stop applying at the prefilter while
    // still applying in `check`, so refuse them here rather than let a
    // pattern match inconsistently between the two passes.
    if (pattern.flags !== '') {
        throw new Error(
            `referencesQuery: flags on ${String(pattern)} don't reach the query's prefilter`,
        )
    }
    const build = (kinds: string[]): string =>
        `([${kinds.join(' ')}] @token (#match? @token "${asQueryString(pattern.source)}"))`
    return {
        typescript: build(TOKEN_KINDS),
        tsx: build([...TOKEN_KINDS, '(jsx_text)']),
    }
}

/**
 * The token's own text. A template literal loses its `${…}` parts, whose
 * names are tokens of their own and would otherwise be reported twice.
 */
export const ownText = (ctx: RuleContext, token: Node): string => {
    let text = ctx.text(token) ?? ''
    if (ctx.kind(token) !== 'template_string') return text
    for (const child of ctx.namedChildren(token)) {
        if (ctx.kind(child) === 'template_substitution') {
            text = text.replace(ctx.text(child) ?? '', '')
        }
    }
    return text
}
