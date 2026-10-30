/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'
import { isPackageOrSubpath } from '../shared/import-sources.js'
import { resolveRelative } from '../shared/paths.js'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'
import { workspaceDirs } from '../shared/workspace.js'

const IMPORTS_QUERY = `
    (import_statement
      (import_clause (named_imports (import_specifier) @spec))
      (string (string_fragment) @src)) @stmt
`

const STORE_QUERY =
    '(lexical_declaration (variable_declarator name: (identifier) @name value: (call_expression) @call)) @decl'

const REGISTER_QUERY =
    '(call_expression function: (identifier) @fn arguments: (arguments) @args)'

const IDENTIFIER_QUERY = '(identifier) @id'

type NamedImport = { imported: string; source: string }

// Metro picks `foo.web.ts` or `foo.ts` for one `./foo` import, so the variants
// of a store share the registration that imports it.
const PLATFORM_SUFFIX = /\.(web|native|ios|android)$/
const EXTENSION = /\.[cm]?[jt]sx?$/

const stemOf = (path: string): string =>
    path.replace(EXTENSION, '').replace(PLATFORM_SUFFIX, '')

type ImportTarget = { match: 'path' | 'package' | 'tail'; target: string }

/** Where an import's store can live: a resolved path, a workspace package directory, or, for an alias, its last segment. */
const importTarget = (
    ctx: RuleContext,
    source: string,
    packages: () => Map<string, string>,
): ImportTarget | undefined => {
    if (source.startsWith('.')) {
        return {
            match: 'path',
            target: stemOf(resolveRelative(ctx.filePath, source)),
        }
    }
    for (const [name, dir] of packages()) {
        if (isPackageOrSubpath(source, name)) {
            return { match: 'package', target: dir }
        }
    }
    const tail = stemOf(source.split('/').pop() ?? '')
    return tail === '' ? undefined : { match: 'tail', target: tail }
}

const covers = (match: unknown, target: string, file: string): boolean => {
    const stem = stemOf(file)
    if (match === 'path') {
        // A directory import reaches its stores through the index barrel.
        return stem === target || stem.startsWith(`${target}/`)
    }
    if (match === 'package') return file.startsWith(`${target}/`)
    if (match === 'tail') {
        return stem.split('/').pop() === target || file.includes(`/${target}/`)
    }
    return false
}

const namedImports = (
    ctx: RuleContext,
    prog: Node,
): Map<string, NamedImport> => {
    const imports = new Map<string, NamedImport>()
    for (const match of ctx.querySubtree(prog, IMPORTS_QUERY)) {
        const spec = match.spec
        const src = match.src
        if (spec === undefined || src === undefined) continue
        const source = ctx.text(src)
        if (source === undefined) continue

        const identifiers = ctx
            .children(spec)
            .filter(c => ctx.kind(c) === 'identifier')
        const first = identifiers[0]
        if (first === undefined) continue
        const imported = ctx.text(first)
        // `{ a as b }`: the second identifier is the local name.
        const second = identifiers[1]
        const local = second === undefined ? imported : ctx.text(second)
        if (imported === undefined || local === undefined) continue
        imports.set(local, { imported, source })
    }
    return imports
}

// `create<T>()(…)` is a call of a call; the callee that names the factory is at
// the bottom of that chain.
const innermostCallee = (ctx: RuleContext, call: Node): Node | undefined => {
    let current: Node | undefined = call
    while (current !== undefined && ctx.kind(current) === 'call_expression') {
        current = ctx.namedChildren(current)[0]
    }
    return current !== undefined && ctx.kind(current) === 'identifier'
        ? current
        : undefined
}

export default defineRule({
    id: 'pera/store-in-wipe-registry',
    severity: 'error',
    card: {
        message:
            'a Zustand store is not registered for the delete-all-data wipe',
        remediation:
            'Call `registerStore({ name, clearStorage, resetState })` from `@perawallet/wallet-core-shared` at module scope beside the store, or in a file that imports it from the module that declares it, naming the store inside the argument of the call: `resetState` puts it back to its initial state, `clearStorage` removes its persisted record (`() => {}` for an in-memory store). A store that a wipe would break if reset (device state, a mounted UI host) instead takes a suppression on its declaration line saying what breaks (lanekeep/README.md, "Suppressing"). A store built inside a function is not checked.',
        examples: {
            bad: 'export const useDraftStore = create<Draft>()(set => ({ … })) // nothing registers it',
            good: "registerStore({ name: 'draft-store', clearStorage: () => {}, resetState: () => useDraftStore.getState().resetState() })",
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    query: '(program) @prog',
    check(ctx, m) {
        const prog = m.prog
        if (prog === undefined) return
        if (
            !ctx.fileText.includes('zustand') &&
            !ctx.fileText.includes('registerStore')
        ) {
            return
        }

        const imports = namedImports(ctx, prog)
        const factories = new Set<string>()
        const registrars = new Set<string>()
        for (const [local, { imported, source }] of imports) {
            if (imported === 'create' && source === 'zustand') {
                factories.add(local)
            }
            // The source is not checked: a package-internal file may import the
            // registry by a relative path, and an extra match only under-reports.
            if (imported === 'registerStore') registrars.add(local)
        }

        const localStores = new Set<string>()
        if (factories.size > 0) {
            for (const match of ctx.querySubtree(prog, STORE_QUERY)) {
                const name = match.name
                const call = match.call
                const decl = match.decl
                if (
                    name === undefined ||
                    call === undefined ||
                    decl === undefined
                ) {
                    continue
                }
                const callee = innermostCallee(ctx, call)
                const calleeName =
                    callee === undefined ? undefined : ctx.text(callee)
                if (calleeName === undefined || !factories.has(calleeName)) {
                    continue
                }

                // A store built inside a function is re-created per call, so
                // only a module-scope declaration has one instance to register.
                const parent = ctx.parent(decl)
                if (parent === undefined) continue
                const isExported = ctx.kind(parent) === 'export_statement'
                const container = isExported ? ctx.parent(parent) : parent
                if (
                    container === undefined ||
                    ctx.kind(container) !== 'program'
                ) {
                    continue
                }

                const storeName = ctx.text(name)
                const at = ctx.loc(name)
                if (storeName === undefined || at === undefined) continue
                localStores.add(storeName)
                ctx.emitFact({
                    kind: 'store',
                    name: storeName,
                    isExported,
                    line: at.line,
                    column: at.column,
                })
            }
        }

        if (registrars.size === 0) return
        let packages: Map<string, string> | undefined
        const packageDirs = () => (packages ??= workspaceDirs(ctx, ''))
        const seen = new Set<string>()
        for (const match of ctx.querySubtree(prog, REGISTER_QUERY)) {
            const fn = match.fn
            const args = match.args
            if (fn === undefined || args === undefined) continue
            const fnName = ctx.text(fn)
            if (fnName === undefined || !registrars.has(fnName)) continue

            for (const idMatch of ctx.querySubtree(args, IDENTIFIER_QUERY)) {
                const id = idMatch.id
                if (id === undefined) continue
                const name = ctx.text(id)
                if (name === undefined) continue

                if (localStores.has(name)) {
                    const key = `local:${name}`
                    if (seen.has(key)) continue
                    seen.add(key)
                    ctx.emitFact({ kind: 'registration', name, via: 'local' })
                    continue
                }
                const imported = imports.get(name)
                if (imported === undefined) continue
                const key = `import:${imported.imported}:${imported.source}`
                if (seen.has(key)) continue
                seen.add(key)
                const at = importTarget(ctx, imported.source, packageDirs)
                if (at === undefined) continue
                ctx.emitFact({
                    kind: 'registration',
                    name: imported.imported,
                    via: 'import',
                    ...at,
                })
            }
        }
    },
    reduce(ctx) {
        const local = new Set<string>()
        const imported = new Map<string, { match: unknown; target: string }[]>()
        for (const fact of ctx.facts('registration')) {
            const name = String(fact.name)
            if (fact.via === 'local') {
                local.add(`${fact.file}::${name}`)
                continue
            }
            const targets = imported.get(name) ?? []
            targets.push({ match: fact.match, target: String(fact.target) })
            imported.set(name, targets)
        }

        for (const fact of ctx.facts('store')) {
            const name = String(fact.name)
            const file = String(fact.file)
            if (local.has(`${file}::${name}`)) continue
            if (
                fact.isExported === true &&
                (imported.get(name) ?? []).some(t =>
                    covers(t.match, t.target, file),
                )
            ) {
                continue
            }
            ctx.report(
                {
                    file: fact.file,
                    line: Number(fact.line),
                    column: Number(fact.column),
                },
                `store "${name}" is never passed to registerStore, so delete-all-data leaves its state for the next wallet`,
            )
        }
    },
})
