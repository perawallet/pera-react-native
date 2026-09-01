/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    MAKE_STYLES_QUERY,
    isRneuiMakeStyles,
    relativeBase,
    resolveRelative,
    styleEntries,
    webVariant,
} from '../shared/make-styles.js'

const IMPORTS_QUERY = `
    (import_statement
      (import_clause (named_imports (import_specifier) @spec))
      (string (string_fragment) @src)) @stmt
`

const DECL_QUERY =
    '(variable_declarator value: (call_expression function: (identifier) @callee)) @decl'

const MEMBER_QUERY =
    '(member_expression object: (identifier) @obj property: (property_identifier) @prop)'

const SUBSCRIPT_QUERY = '(subscript_expression object: (identifier) @obj)'

export default defineRule({
    id: 'pera/no-unused-style-keys',
    severity: 'error',
    card: {
        message: 'style key is never referenced',
        remediation:
            'Remove the unused style key, or reference it as styles.<key>. If it is reached dynamically (styles[variant]), suppress it with a lanekeep-ignore-next-line directive and a reason.',
        examples: {
            bad: 'unused: { flex: 1 } // nothing reads styles.unused',
            good: "row: { flexDirection: 'row' } // read as styles.row",
        },
    },
    // Every other rule uses `gates` to skip files its query can't match; this
    // one can't — the reduce pass below needs a keydef/usage fact from every
    // file that might import a styles hook, not just files that declare one,
    // so it deliberately reads the whole corpus and gates internally instead
    // (see `mayDeclare` below). Do not "fix" this by adding a `gates` clause.
    query: '(program) @prog',
    check(ctx, m) {
        const prog = m.prog
        if (prog === undefined) return

        // Hooks declared here, so a call to one in this same file resolves
        // without an import to follow.
        const declaredHooks: string[] = []

        // The query matches the identifier literally, so a file whose text
        // lacks it cannot produce a match — and this rule reads every file in
        // the repo, where most declare no styles at all.
        const mayDeclare = ctx.fileText.includes('makeStyles')
        for (const match of mayDeclare
            ? ctx.querySubtree(prog, MAKE_STYLES_QUERY)
            : []) {
            const call = match.call
            const fn = match.fn
            if (call === undefined || fn === undefined) continue
            if (!isRneuiMakeStyles(ctx, fn)) continue

            const declarator = ctx.closestAncestor(
                call,
                '(variable_declarator name: (identifier) @n) @d',
            )
            const declNode = declarator?.d
            const hook =
                declarator?.n === undefined ? undefined : ctx.text(declarator.n)
            if (hook === undefined || declNode === undefined) continue
            declaredHooks.push(hook)

            // Only an exported hook has a knowable set of consumers. A local
            // one can be reached by anything in its own file that this rule
            // does not model, so its keys are never reported.
            const list = ctx.parent(declNode)
            const stmt = list === undefined ? undefined : ctx.parent(list)
            if (stmt === undefined || ctx.kind(stmt) !== 'export_statement') {
                continue
            }

            for (const entry of styleEntries(ctx, call)) {
                const at = ctx.loc(entry.keyNode)
                if (at === undefined) continue
                ctx.emitFact({
                    kind: 'keydef',
                    hook,
                    key: entry.key,
                    line: at.line,
                    column: at.column,
                })
            }
        }

        // Local hook name -> the `file::hookName` it came from. A hook reached
        // through the platform-agnostic import is also used in the `.web`
        // sibling, so both ids are recorded.
        const owners = new Map<string, string[]>()
        for (const match of ctx.querySubtree(prog, IMPORTS_QUERY)) {
            const src = match.src
            const spec = match.spec
            if (src === undefined || spec === undefined) continue
            const specifier = ctx.text(src)
            if (specifier === undefined) continue

            const identifiers = ctx
                .children(spec)
                .filter(c => ctx.kind(c) === 'identifier')
            const first = identifiers[0]
            if (first === undefined) continue
            const imported = ctx.text(first)
            // `{ a as b }` — the second identifier is the local name.
            const second = identifiers[1]
            const local = second === undefined ? imported : ctx.text(second)
            if (imported === undefined || local === undefined) continue

            const resolved = resolveRelative(ctx, ctx.filePath, specifier)
            if (resolved === undefined) {
                // A consumer this resolver cannot follow leaves the hook it
                // names unknowable rather than unused, so record enough to
                // silence it. Both forms below can only lose a finding, never
                // invent one.
                //
                // A relative path that matched no candidate still names a known
                // location: `./styles` beside a lone `styles.web.ts` is a real
                // module the bundler resolves by platform suffix.
                const base = relativeBase(ctx.filePath, specifier)
                if (base !== undefined) {
                    ctx.emitFact({ kind: 'opaque', base, name: imported })
                    continue
                }
                // An alias such as `@modules/Foo/styles` has no computable
                // path, so fall back to matching its trailing segments.
                const tail = specifier
                    .split('/')
                    .filter(p => p !== '' && p !== '.' && p !== '..')
                    .slice(-2)
                    .join('/')
                if (tail.includes('/')) {
                    ctx.emitFact({ kind: 'opaque', tail, name: imported })
                }
                continue
            }

            const files = [resolved]
            const web = webVariant(ctx, resolved)
            if (web !== undefined) files.push(web)
            owners.set(
                local,
                files.map(f => `${f}::${imported}`),
            )
        }
        for (const hook of declaredHooks) {
            if (!owners.has(hook)) {
                owners.set(hook, [`${ctx.filePath}::${hook}`])
            }
        }
        if (owners.size === 0) return

        // Nodes the passes below have already interpreted. Anything else that
        // names a style variable is a whole-object reference.
        const accounted = new Set<number>()

        // Local variable holding a hook's result -> the owner ids it stands for.
        const styleVars = new Map<string, string[]>()
        for (const match of ctx.querySubtree(prog, DECL_QUERY)) {
            const callee = match.callee
            const decl = match.decl
            if (callee === undefined || decl === undefined) continue
            const calleeName = ctx.text(callee)
            if (calleeName === undefined) continue
            const ids = owners.get(calleeName)
            if (ids === undefined) continue

            const target = ctx.namedChildren(decl)[0]
            if (target === undefined) continue
            const kind = ctx.kind(target)

            if (kind === 'identifier') {
                const varName = ctx.text(target)
                if (varName !== undefined) {
                    styleVars.set(varName, ids)
                    accounted.add(target)
                }
                continue
            }
            if (kind !== 'object_pattern') {
                // An array pattern or anything else unmodelled could read any key.
                for (const id of ids)
                    ctx.emitFact({ kind: 'usage', id, key: '*' })
                continue
            }

            for (const element of ctx.namedChildren(target)) {
                // `{ ...rest }` could read any key.
                if (ctx.kind(element) === 'rest_pattern') {
                    for (const id of ids) {
                        ctx.emitFact({ kind: 'usage', id, key: '*' })
                    }
                    continue
                }
                const raw = ctx.text(element)
                if (raw === undefined) continue
                // `{ a }` and `{ a: b }` both name the style key on the left.
                const key = raw.split(':')[0]?.trim()
                if (key === undefined || key.length === 0) continue
                // A computed or defaulted binding does not name a literal key.
                if (!/^[A-Za-z_$][\w$]*$/.test(key)) {
                    for (const id of ids) {
                        ctx.emitFact({ kind: 'usage', id, key: '*' })
                    }
                    continue
                }
                for (const id of ids) ctx.emitFact({ kind: 'usage', id, key })
            }
        }
        if (styleVars.size === 0) return

        for (const match of ctx.querySubtree(prog, MEMBER_QUERY)) {
            const obj = match.obj
            const prop = match.prop
            if (obj === undefined || prop === undefined) continue
            const objName = ctx.text(obj)
            const ids =
                objName === undefined ? undefined : styleVars.get(objName)
            if (ids === undefined) continue
            accounted.add(obj)
            const key = ctx.text(prop)
            if (key === undefined) continue
            for (const id of ids) ctx.emitFact({ kind: 'usage', id, key })
        }

        // `styles[variant]` could read any key.
        for (const match of ctx.querySubtree(prog, SUBSCRIPT_QUERY)) {
            const obj = match.obj
            if (obj === undefined) continue
            const objName = ctx.text(obj)
            const ids =
                objName === undefined ? undefined : styleVars.get(objName)
            if (ids === undefined) continue
            accounted.add(obj)
            for (const id of ids) ctx.emitFact({ kind: 'usage', id, key: '*' })
        }

        // The whole object escaping — spread, passed as a prop, returned —
        // puts every key beyond reach. Missing one of these is what makes this
        // rule recommend deleting code that is in use, so anything naming a
        // style variable outside the forms above counts as reaching all of it.
        const names = [...styleVars.keys()].map(n => `"${n}"`).join(' ')
        for (const match of ctx.querySubtree(
            prog,
            // `{ styles }` parses the name as a shorthand property rather than
            // an identifier, so omitting it would let the object escape unseen.
            `([(identifier) (shorthand_property_identifier)] @id (#any-of? @id ${names}))`,
        )) {
            const id = match.id
            if (id === undefined || accounted.has(id)) continue
            const ids = styleVars.get(ctx.text(id) ?? '')
            if (ids === undefined) continue
            for (const owner of ids) {
                ctx.emitFact({ kind: 'usage', id: owner, key: '*' })
            }
        }
    },
    reduce(ctx) {
        const used = new Set<string>()
        const dynamic = new Set<string>()
        for (const fact of ctx.facts('usage')) {
            const id = String(fact.id)
            if (fact.key === '*') dynamic.add(id)
            else used.add(`${id}::${String(fact.key)}`)
        }

        // Keyed by imported name because every unresolvable named import in the
        // corpus emits one of these — tens of thousands — and a scan per key
        // definition would cost the product of the two.
        const opaqueByName = new Map<
            string,
            { base?: string; tail?: string }[]
        >()
        for (const fact of ctx.facts('opaque')) {
            const name = String(fact.name)
            const entry = {
                base: fact.base === undefined ? undefined : String(fact.base),
                tail: fact.tail === undefined ? undefined : String(fact.tail),
            }
            const list = opaqueByName.get(name)
            if (list === undefined) opaqueByName.set(name, [entry])
            else list.push(entry)
        }
        // A base is an exact location, so any extension the bundler might have
        // picked counts. A tail is a guess, so it is held to known extensions.
        const reachedOpaquely = (file: string, hook: string): boolean =>
            (opaqueByName.get(hook) ?? []).some(o => {
                if (o.base !== undefined) return file.startsWith(`${o.base}.`)
                return ['.ts', '.tsx', '.web.ts', '.web.tsx'].some(ext =>
                    file.endsWith(`/${String(o.tail)}${ext}`),
                )
            })

        for (const fact of ctx.facts('keydef')) {
            const file = String(fact.file)
            const hook = String(fact.hook)
            const id = `${file}::${hook}`
            if (dynamic.has(id)) continue
            if (reachedOpaquely(file, hook)) continue
            if (used.has(`${id}::${String(fact.key)}`)) continue
            ctx.report(
                {
                    file: fact.file,
                    line: Number(fact.line),
                    column: Number(fact.column),
                },
                `style key "${String(fact.key)}" is never referenced`,
            )
        }
    },
})
