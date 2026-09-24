/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Match, Node, RuleContext } from 'lanekeep'

/**
 * Every position that creates a module dependency: static and type-only
 * imports, `export … from`, `import()` and `require()`, with a string or a
 * substitution-free template specifier.
 */
export const IMPORT_SOURCES_QUERY = `
    (import_statement source: (string (string_fragment) @spec)) @site
    (export_statement source: (string (string_fragment) @spec)) @site
    (call_expression
      function: (import)
      arguments: (arguments . [(string (string_fragment) @spec) (template_string) @spec])) @site
    ((call_expression
       function: (identifier) @require
       arguments: (arguments . [(string (string_fragment) @spec) (template_string) @spec])) @site
     (#eq? @require "require"))
`

// lanekeep 0.11.0's loader corrupts parsing when an `export interface`/`export
// type X = …` declaration sits immediately next to another top-level export
// (before, after, or at end-of-file) — confirmed by bisection against the
// pinned version. Declaring the shape unexported and re-exporting it through a
// type-only export clause (itself immune) sidesteps the bug without changing
// the public surface.
interface ImportSource {
    specifier: string
    site: Node
}
export type { ImportSource }

/** The match's specifier, or undefined for a template with substitutions. */
export const importSourceOf = (
    ctx: RuleContext,
    m: Match,
): ImportSource | undefined => {
    const spec = m.spec
    const site = m.site
    if (spec === undefined || site === undefined) return undefined
    const text = ctx.text(spec)
    if (text === undefined) return undefined

    let specifier = text
    if (ctx.kind(spec) === 'template_string') {
        const children = ctx.namedChildren(spec)
        if (children.some(c => ctx.kind(c) === 'template_substitution')) {
            return undefined
        }
        specifier = text.slice(1, -1)
    }
    return { specifier, site }
}

/** `pkg` itself or any subpath of it. */
export const isPackageOrSubpath = (specifier: string, pkg: string): boolean =>
    specifier === pkg || specifier.startsWith(`${pkg}/`)
