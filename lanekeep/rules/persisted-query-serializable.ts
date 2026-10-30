/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, ReduceContext, RuleContext } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

/**
 * Type names a persisted payload must not reach. They mirror
 * `stringifyTypedJson` in packages/shared/src/utils/json.ts, which tags
 * `bigint`, `Map`, `Uint8Array` and `Decimal` only.
 */
export const UNTAGGED_TYPES = ['Date', 'Set', 'ReadonlySet'] as const

type KeySegment = { lit: string } | { ref: string } | { spread: string }

interface TypeSummary {
    untagged: string[]
    refs: string[]
}

type Payload =
    | { state: 'summary'; untagged: string[]; refs: string[] }
    | { state: 'unannotated' }
    | { state: 'opaque'; text: string }

type SiteKey = { segments: KeySegment[] } | { builder: string }

const UNTAGGED = new Set<string>(UNTAGGED_TYPES)
const FUNCTION_SHAPES = new Set([
    'function_type',
    'method_signature',
    'call_signature',
    'construct_signature',
])
const WRAPPERS = new Set([
    'as_expression',
    'satisfies_expression',
    'parenthesized_expression',
    'non_null_expression',
])
const FUNCTIONS = new Set([
    'arrow_function',
    'function_expression',
    'function',
    'function_declaration',
    'method_definition',
])
const DOTTED = /^[\w$]+(?:\.[\w$]+)*$/
const MAX_ALIAS_HOPS = 5

const text = (ctx: RuleContext, node: Node): string => ctx.text(node) ?? ''

const unwrapExpression = (ctx: RuleContext, node: Node): Node => {
    let current = node
    while (WRAPPERS.has(ctx.kind(current) ?? '')) {
        const inner = ctx.namedChildren(current)[0]
        if (inner === undefined) break
        current = inner
    }
    return current
}

const unquote = (raw: string): string => raw.slice(1, -1)

const isModuleScope = (ctx: RuleContext, node: Node): boolean => {
    let parent = ctx.parent(node)
    if (parent !== undefined && ctx.kind(parent) === 'export_statement') {
        parent = ctx.parent(parent)
    }
    return parent !== undefined && ctx.kind(parent) === 'program'
}

/** The `apps|packages|extensions/<name>` root anywhere in the path, else the file's directory. */
const packageOf = (file: string): string => {
    const match = /(?:^|\/)((?:apps|packages|extensions)\/[^/]+)\//.exec(file)
    if (match !== null) return match[1]!
    return file.split('/').slice(0, -1).join('/')
}

/** Whether the longest policy entry that is a leading run of `path` is `'persist'`. */
const persistedPath = (
    policy: Map<string, string>,
    path: string[],
): boolean => {
    let best = -1
    let verdict = ''
    for (const [entry, value] of policy) {
        const parts = entry.split('/')
        if (parts.length > path.length || parts.length <= best) continue
        if (parts.every((part, i) => path[i] === part)) {
            best = parts.length
            verdict = value
        }
    }
    return verdict === 'persist'
}

/** The builder or array a `...spread` key element names, when it is a plain reference or call. */
const spreadName = (ctx: RuleContext, spread: Node): string | undefined => {
    const target = ctx.namedChildren(spread)[0]
    if (target === undefined) return undefined
    let expression = unwrapExpression(ctx, target)
    if (ctx.kind(expression) === 'call_expression') {
        expression = ctx.namedChildren(expression)[0] ?? expression
    }
    const name = text(ctx, expression)
    return DOTTED.test(name) ? name : undefined
}

const segmentsOf = (ctx: RuleContext, array: Node): KeySegment[] => {
    const segments: KeySegment[] = []
    for (const child of ctx.namedChildren(array)) {
        if (ctx.kind(child) === 'spread_element') {
            const spread = spreadName(ctx, child)
            if (spread === undefined) break
            segments.push({ spread })
            continue
        }
        const element = unwrapExpression(ctx, child)
        const kind = ctx.kind(element)
        if (kind === 'string') {
            segments.push({ lit: unquote(text(ctx, element)) })
        } else if (kind === 'identifier') {
            segments.push({ ref: text(ctx, element) })
        } else {
            break
        }
    }
    return segments
}

const returnedArray = (ctx: RuleContext, fn: Node): Node | undefined => {
    const body = ctx.namedChildren(fn).at(-1)
    if (body === undefined) return undefined
    if (ctx.kind(body) !== 'statement_block') {
        const expression = unwrapExpression(ctx, body)
        return ctx.kind(expression) === 'array' ? expression : undefined
    }
    const arrays: Node[] = []
    for (const statement of ctx.namedChildren(body)) {
        if (ctx.kind(statement) !== 'return_statement') continue
        const value = ctx.namedChildren(statement)[0]
        const expression =
            value === undefined ? undefined : unwrapExpression(ctx, value)
        if (expression === undefined || ctx.kind(expression) !== 'array') {
            return undefined
        }
        arrays.push(expression)
    }
    return arrays[0]
}

const declaratorParts = (
    ctx: RuleContext,
    declarator: Node,
): { name: string; value: Node } | undefined => {
    const parts = ctx.namedChildren(declarator)
    const name = parts[0]
    const value = parts.at(-1)
    if (
        name === undefined ||
        value === undefined ||
        parts.length < 2 ||
        ctx.kind(name) !== 'identifier' ||
        ctx.kind(value) === 'type_annotation'
    ) {
        return undefined
    }
    return { name: text(ctx, name), value }
}

/** A `const name = value` in the nearest enclosing block or module that declares it. */
const findDeclaration = (
    ctx: RuleContext,
    from: Node,
    name: string,
): Node | undefined => {
    let scope = ctx.parent(from)
    while (scope !== undefined) {
        const kind = ctx.kind(scope)
        if (kind === 'statement_block' || kind === 'program') {
            for (const statement of ctx.namedChildren(scope)) {
                let declaration = statement
                if (ctx.kind(declaration) === 'export_statement') {
                    declaration = ctx.namedChildren(declaration)[0] ?? statement
                }
                if (ctx.kind(declaration) !== 'lexical_declaration') continue
                for (const declarator of ctx.namedChildren(declaration)) {
                    const parts = declaratorParts(ctx, declarator)
                    if (parts !== undefined && parts.name === name) {
                        return parts.value
                    }
                }
            }
        }
        scope = ctx.parent(scope)
    }
    return undefined
}

const keyFromExpression = (
    ctx: RuleContext,
    node: Node,
    depth: number,
): SiteKey[] => {
    const expression = unwrapExpression(ctx, node)
    const kind = ctx.kind(expression)
    if (kind === 'array') return [{ segments: segmentsOf(ctx, expression) }]
    if (kind === 'ternary_expression') {
        const [, consequence, alternative] = ctx.namedChildren(expression)
        return [consequence, alternative].flatMap(arm =>
            arm === undefined ? [] : keyFromExpression(ctx, arm, depth),
        )
    }
    if (kind === 'call_expression') {
        const callee = ctx.namedChildren(expression)[0]
        const name = callee === undefined ? '' : text(ctx, callee)
        return DOTTED.test(name) ? [{ builder: name }] : []
    }
    if (kind === 'member_expression') {
        const name = text(ctx, expression)
        return DOTTED.test(name) ? [{ builder: name }] : []
    }
    if (kind === 'identifier' || kind === 'shorthand_property_identifier') {
        const name = text(ctx, expression)
        const declared =
            depth < 3 ? findDeclaration(ctx, expression, name) : undefined
        if (declared !== undefined) {
            return keyFromExpression(ctx, declared, depth + 1)
        }
        return [{ builder: name }]
    }
    return []
}

const keyOf = (ctx: RuleContext, object: Node): SiteKey[] => {
    for (const member of ctx.namedChildren(object)) {
        const kind = ctx.kind(member)
        if (kind === 'shorthand_property_identifier') {
            if (text(ctx, member) !== 'queryKey') continue
            return keyFromExpression(ctx, member, 0)
        }
        if (kind !== 'pair') continue
        const [name, value] = ctx.namedChildren(member)
        if (
            name === undefined ||
            value === undefined ||
            text(ctx, name) !== 'queryKey'
        ) {
            continue
        }
        return keyFromExpression(ctx, value, 0)
    }
    return []
}

const addTypeNames = (
    ctx: RuleContext,
    node: Node,
    exclude: ReadonlySet<string>,
    out: TypeSummary,
): void => {
    const kind = ctx.kind(node) ?? ''
    if (FUNCTION_SHAPES.has(kind)) return
    if (kind === 'nested_type_identifier') {
        const last = ctx.namedChildren(node).at(-1)
        if (last !== undefined) addTypeNames(ctx, last, exclude, out)
        return
    }
    if (kind === 'type_identifier' || kind === 'identifier') {
        const name = text(ctx, node)
        if (UNTAGGED.has(name)) out.untagged.push(name)
        else if (!exclude.has(name)) out.refs.push(name)
        return
    }
    for (const child of ctx.namedChildren(node)) {
        addTypeNames(ctx, child, exclude, out)
    }
}

const dedupe = (summary: TypeSummary): TypeSummary => ({
    untagged: [...new Set(summary.untagged)],
    refs: [...new Set(summary.refs)],
})

const summarizeType = (
    ctx: RuleContext,
    node: Node,
    exclude: ReadonlySet<string>,
): TypeSummary => {
    const out: TypeSummary = { untagged: [], refs: [] }
    addTypeNames(ctx, node, exclude, out)
    return dedupe(out)
}

const summarizeDeclaration = (
    ctx: RuleContext,
    declaration: Node,
    nameNode: Node,
): TypeSummary => {
    const exclude = new Set<string>()
    const out: TypeSummary = { untagged: [], refs: [] }
    const members = ctx.namedChildren(declaration)
    for (const member of members) {
        if (ctx.kind(member) !== 'type_parameters') continue
        for (const parameter of ctx.namedChildren(member)) {
            const name = ctx.namedChildren(parameter)[0]
            if (name !== undefined) exclude.add(text(ctx, name))
        }
    }
    for (const member of members) {
        if (member === nameNode || ctx.kind(member) === 'type_parameters') {
            continue
        }
        addTypeNames(ctx, member, exclude, out)
    }
    return dedupe(out)
}

const addSchemaNames = (
    ctx: RuleContext,
    node: Node,
    inTransform: boolean,
    out: TypeSummary,
    isConsumed = false,
): void => {
    const kind = ctx.kind(node) ?? ''
    const children = ctx.namedChildren(node)
    if (kind === 'identifier' || kind === 'type_identifier') {
        const name = text(ctx, node)
        if (!UNTAGGED.has(name) && name !== 'z') out.refs.push(name)
        return
    }
    if (kind === 'new_expression') {
        const constructor = children[0]
        const name = constructor === undefined ? '' : text(ctx, constructor)
        if (inTransform && !isConsumed && UNTAGGED.has(name)) {
            out.untagged.push(name)
        }
    }
    if (kind === 'call_expression') {
        const callee = children[0]
        const args = children[1]
        if (callee !== undefined && ctx.kind(callee) === 'member_expression') {
            const [target, property] = ctx.namedChildren(callee)
            const owner = target === undefined ? '' : text(ctx, target)
            const method = property === undefined ? '' : text(ctx, property)
            if (method === 'date' && (owner === 'z' || owner === 'z.coerce')) {
                out.untagged.push('Date')
            }
            if (method === 'set' && owner === 'z') out.untagged.push('Set')
            if (
                method === 'instanceof' &&
                owner === 'z' &&
                args !== undefined
            ) {
                const first = ctx.namedChildren(args)[0]
                const name = first === undefined ? '' : text(ctx, first)
                if (UNTAGGED.has(name)) out.untagged.push(name)
            }
            if (method === 'transform') {
                if (target !== undefined) {
                    addSchemaNames(ctx, target, inTransform, out)
                }
                if (args !== undefined) addSchemaNames(ctx, args, true, out)
                return
            }
        }
    }
    // A Date or Set that is read through, spread or copied into an array never reaches the payload.
    const consumesFirst =
        kind === 'member_expression' || kind === 'spread_element'
    const callee = kind === 'call_expression' ? children[0] : undefined
    const copiesArgs =
        callee !== undefined && text(ctx, callee) === 'Array.from'
    for (const [index, child] of children.entries()) {
        if (copiesArgs && index > 0 && ctx.kind(child) === 'arguments') {
            for (const arg of ctx.namedChildren(child)) {
                addSchemaNames(ctx, arg, inTransform, out, true)
            }
            continue
        }
        addSchemaNames(
            ctx,
            child,
            inTransform,
            out,
            consumesFirst && index === 0,
        )
    }
}

const summarizeSchema = (ctx: RuleContext, value: Node): TypeSummary => {
    const out: TypeSummary = { untagged: [], refs: [] }
    addSchemaNames(ctx, value, false, out)
    return dedupe(out)
}

const payloadOf = (ctx: RuleContext, value: Node): Payload | undefined => {
    const expression = unwrapExpression(ctx, value)
    const kind = ctx.kind(expression) ?? ''
    if (kind === 'identifier' && text(ctx, expression) === 'skipToken') {
        return undefined
    }
    if (kind === 'ternary_expression') {
        const [, consequence, alternative] = ctx.namedChildren(expression)
        const isSkip = (node: Node | undefined) =>
            node !== undefined && text(ctx, node) === 'skipToken'
        if (isSkip(consequence) && alternative !== undefined) {
            return payloadOf(ctx, alternative)
        }
        if (isSkip(alternative) && consequence !== undefined) {
            return payloadOf(ctx, consequence)
        }
        return { state: 'unannotated' }
    }
    if (!FUNCTIONS.has(kind)) return { state: 'unannotated' }

    const annotation = ctx
        .namedChildren(expression)
        .find(child => ctx.kind(child) === 'type_annotation')
    let type =
        annotation === undefined ? undefined : ctx.namedChildren(annotation)[0]
    if (type === undefined) return { state: 'unannotated' }
    if (ctx.kind(type) === 'generic_type') {
        const [name, args] = ctx.namedChildren(type)
        if (
            name !== undefined &&
            args !== undefined &&
            text(ctx, name) === 'Promise'
        ) {
            type = ctx.namedChildren(args)[0] ?? type
        }
    }
    const typeText = text(ctx, type)
    if (
        /^(?:object|\{\s*\})$/.test(typeText) ||
        /\b(?:unknown|any|ReturnType)\b/.test(typeText)
    ) {
        return { state: 'opaque', text: typeText }
    }
    return { state: 'summary', ...summarizeType(ctx, type, new Set()) }
}

const emitBuilders = (
    ctx: RuleContext,
    name: string,
    value: Node,
    depth: number,
): void => {
    const expression = unwrapExpression(ctx, value)
    const kind = ctx.kind(expression) ?? ''
    if (FUNCTIONS.has(kind)) {
        const array = returnedArray(ctx, expression)
        if (array !== undefined) {
            ctx.emitFact({
                kind: 'key-builder',
                name,
                segments: segmentsOf(ctx, array),
            })
        }
    } else if (kind === 'array') {
        ctx.emitFact({
            kind: 'key-builder',
            name,
            segments: segmentsOf(ctx, expression),
        })
    } else if (kind === 'object' && depth < 3) {
        for (const member of ctx.namedChildren(expression)) {
            const memberKind = ctx.kind(member)
            const [memberName, memberValue] = ctx.namedChildren(member)
            if (memberName === undefined) continue
            const label = text(ctx, memberName).replace(/^['"]|['"]$/g, '')
            if (memberKind === 'pair' && memberValue !== undefined) {
                emitBuilders(ctx, `${name}.${label}`, memberValue, depth + 1)
            } else if (memberKind === 'method_definition') {
                emitBuilders(ctx, `${name}.${label}`, member, depth + 1)
            }
        }
    } else if (
        (kind === 'identifier' || kind === 'member_expression') &&
        DOTTED.test(text(ctx, expression))
    ) {
        ctx.emitFact({
            kind: 'key-alias',
            name,
            target: text(ctx, expression),
        })
    }
}

const emitDeclarator = (
    ctx: RuleContext,
    declarator: Node,
    nameNode: Node,
    value: Node,
): void => {
    const lexical = ctx.parent(declarator)
    if (lexical === undefined || !isModuleScope(ctx, lexical)) return
    const name = text(ctx, nameNode)
    const expression = unwrapExpression(ctx, value)

    if (name === 'QUERY_PREFIX_POLICY' && ctx.kind(expression) === 'object') {
        for (const entry of ctx.namedChildren(expression)) {
            if (ctx.kind(entry) !== 'pair') continue
            const [entryKey, entryValue] = ctx.namedChildren(entry)
            if (entryKey === undefined || entryValue === undefined) continue
            const where = ctx.loc(entry)
            ctx.emitFact({
                kind: 'policy',
                path: text(ctx, entryKey).replace(/^['"]|['"]$/g, ''),
                verdict: unquote(text(ctx, entryValue)),
                line: where?.line ?? 1,
                column: where?.column ?? 1,
            })
        }
        return
    }
    if (ctx.kind(expression) === 'string') {
        ctx.emitFact({
            kind: 'string-const',
            name,
            value: unquote(text(ctx, expression)),
        })
        return
    }
    emitBuilders(ctx, name, value, 0)
    const source = text(ctx, value)
    if (source.length < 20_000 && /\bz\./.test(source)) {
        ctx.emitFact({
            kind: 'type',
            name,
            ...summarizeSchema(ctx, value),
        })
    }
}

const emitQuerySite = (
    ctx: RuleContext,
    object: Node,
    queryFn: Node,
    value: Node | undefined,
): void => {
    const key = keyOf(ctx, object)
    const where = ctx.loc(queryFn)
    if (key.length === 0 || where === undefined) return
    const payload: Payload | undefined =
        value === undefined ? { state: 'unannotated' } : payloadOf(ctx, value)
    if (payload === undefined) return
    ctx.emitFact({
        kind: 'query-site',
        line: where.line,
        column: where.column,
        key,
        payload,
    })
}

interface Fact {
    file: string
    [field: string]: unknown
}

const resolveSegments = (
    segments: KeySegment[],
    file: string,
    sameFile: Map<string, string>,
    samePackage: Map<string, Set<string>>,
    expand: (name: string, file: string) => string[] | undefined,
): string[] => {
    const path: string[] = []
    const pkg = packageOf(file)
    for (const segment of segments) {
        if ('lit' in segment) {
            path.push(segment.lit)
            continue
        }
        if ('spread' in segment) {
            const expanded = expand(segment.spread, file)
            if (expanded === undefined) break
            path.push(...expanded)
            continue
        }
        const local = sameFile.get(`${file}\0${segment.ref}`)
        if (local !== undefined) {
            path.push(local)
            continue
        }
        const shared = samePackage.get(`${pkg}\0${segment.ref}`)
        if (shared !== undefined && shared.size === 1) {
            path.push([...shared][0]!)
            continue
        }
        break
    }
    return path
}

const reduce = (ctx: ReduceContext): void => {
    const policy = new Map<string, string>()
    const policyFacts = new Map<string, Fact>()
    for (const fact of ctx.facts('policy')) {
        policy.set(String(fact.path), String(fact.verdict))
        policyFacts.set(String(fact.path), fact as Fact)
    }
    if (policy.size === 0) return

    const sameFile = new Map<string, string>()
    const samePackage = new Map<string, Set<string>>()
    for (const fact of ctx.facts('string-const')) {
        const file = String(fact.file)
        const name = String(fact.name)
        const value = String(fact.value)
        sameFile.set(`${file}\0${name}`, value)
        const packageKey = `${packageOf(file)}\0${name}`
        const values = samePackage.get(packageKey) ?? new Set<string>()
        values.add(value)
        samePackage.set(packageKey, values)
    }

    const builders = new Map<string, Fact[]>()
    for (const fact of ctx.facts('key-builder')) {
        const list = builders.get(String(fact.name)) ?? []
        list.push(fact as Fact)
        builders.set(String(fact.name), list)
    }
    const aliases = new Map<string, Fact[]>()
    for (const fact of ctx.facts('key-alias')) {
        const list = aliases.get(String(fact.name)) ?? []
        list.push(fact as Fact)
        aliases.set(String(fact.name), list)
    }
    const types = new Map<string, Fact[]>()
    for (const fact of ctx.facts('type')) {
        const list = types.get(String(fact.name)) ?? []
        list.push(fact as Fact)
        types.set(String(fact.name), list)
    }

    const buildersFor = (name: string, file: string): Fact[] => {
        const pkg = packageOf(file)
        const names = new Set<string>([name])
        let frontier = [name]
        for (let hop = 0; hop < MAX_ALIAS_HOPS; hop++) {
            const next: string[] = []
            for (const current of frontier) {
                const found = aliases.get(current) ?? []
                const local = found.filter(a => packageOf(a.file) === pkg)
                for (const alias of local.length > 0 ? local : found) {
                    const target = String(alias.target)
                    if (!names.has(target)) {
                        names.add(target)
                        next.push(target)
                    }
                }
            }
            frontier = next
        }
        const found: Fact[] = []
        for (const each of names) found.push(...(builders.get(each) ?? []))
        const local = found.filter(b => packageOf(b.file) === pkg)
        return local.length > 0 ? local : found
    }

    // Past this many nested spreads the key is left unresolved rather than looping.
    const MAX_SPREAD_DEPTH = 4
    const pathsOfBuilder = (
        name: string,
        file: string,
        depth: number,
    ): string[][] =>
        buildersFor(name, file).map(b =>
            resolveSegments(
                b.segments as KeySegment[],
                b.file,
                sameFile,
                samePackage,
                (spread, spreadFile) =>
                    depth >= MAX_SPREAD_DEPTH
                        ? undefined
                        : pathsOfBuilder(spread, spreadFile, depth + 1)[0],
            ),
        )

    const pathsOf = (site: Fact): string[][] =>
        (site.key as SiteKey[]).flatMap(key =>
            'segments' in key
                ? [
                      resolveSegments(
                          key.segments,
                          site.file,
                          sameFile,
                          samePackage,
                          (spread, spreadFile) =>
                              pathsOfBuilder(spread, spreadFile, 1)[0],
                      ),
                  ]
                : pathsOfBuilder(key.builder, site.file, 0),
        )

    const untaggedVia = (
        payload: { untagged: string[]; refs: string[] },
        pkg: string,
    ): { type: string; chain: string[] } | undefined => {
        const direct = payload.untagged[0]
        if (direct !== undefined) return { type: direct, chain: [] }
        const seen = new Set<string>()
        let queue = payload.refs.map(name => ({ name, pkg, chain: [name] }))
        while (queue.length > 0) {
            const next: typeof queue = []
            for (const entry of queue) {
                const declared = types.get(entry.name) ?? []
                const local = declared.filter(
                    d => packageOf(d.file) === entry.pkg,
                )
                for (const declaration of local.length > 0 ? local : declared) {
                    const id = `${declaration.file}\0${entry.name}`
                    if (seen.has(id)) continue
                    seen.add(id)
                    const untagged = (declaration.untagged as string[])[0]
                    if (untagged !== undefined) {
                        return { type: untagged, chain: entry.chain }
                    }
                    for (const ref of declaration.refs as string[]) {
                        next.push({
                            name: ref,
                            pkg: packageOf(declaration.file),
                            chain: [...entry.chain, ref],
                        })
                    }
                }
            }
            queue = next
        }
        return undefined
    }

    const reached = new Set<string>()
    for (const site of ctx.facts('query-site')) {
        const paths = pathsOf(site as Fact)
        for (const candidate of paths) {
            for (const entry of policy.keys()) {
                const parts = entry.split('/')
                if (
                    parts.length <= candidate.length &&
                    parts.every((part, i) => candidate[i] === part)
                ) {
                    reached.add(entry)
                }
            }
        }
        const path = paths.find(candidate => persistedPath(policy, candidate))
        if (path === undefined) continue
        const key = path.join('/')
        const payload = site.payload as Payload
        let message: string | undefined
        if (payload.state === 'unannotated') {
            message = `persisted query "${key}" needs an explicit queryFn return type so its payload can be checked`
        } else if (payload.state === 'opaque') {
            message = `persisted query "${key}" declares its payload as ${payload.text}; name the payload type`
        } else {
            const hit = untaggedVia(payload, packageOf(site.file))
            if (hit !== undefined) {
                const via =
                    hit.chain.length > 0
                        ? ` (via ${hit.chain.join(' → ')})`
                        : ''
                message = `persisted query "${key}" caches ${hit.type}${via}, which the cache serializer does not round-trip`
            }
        }
        if (message === undefined) continue
        ctx.report(
            {
                file: site.file,
                line: Number(site.line),
                column: Number(site.column),
            },
            message,
        )
    }

    for (const [entry, verdict] of policy) {
        const fact = policyFacts.get(entry)
        if (verdict !== 'persist' || reached.has(entry) || fact === undefined) {
            continue
        }
        ctx.report(
            {
                file: fact.file,
                line: Number(fact.line),
                column: Number(fact.column),
            },
            `QUERY_PREFIX_POLICY persists "${entry}" but no query key resolves to it; the entry is stale or its key shape changed`,
        )
    }
}

export default defineRule({
    id: 'pera/persisted-query-serializable',
    severity: 'error',
    card: {
        message:
            'a persisted query caches a value the cache serializer does not round-trip',
        remediation:
            "Cache the raw shape and build the value in `select`; or tag the type in `stringifyTypedJson`/`parseTypedJson` with a round-trip test; or mark the key 'never' in QUERY_PREFIX_POLICY. A persisted `queryFn` is an inline `(): Promise<Payload> =>` or `queryFn(): Promise<Payload> {…}` (wrap a bare `queryFn: fetchX`, even an annotated one) naming a declared type, never `unknown`/`any`.",
        examples: {
            bad: "useQuery({ queryKey: ['banners'], queryFn: (): Promise<{ at: Date }> => fetchAt() })",
            good: "useQuery({ queryKey: ['banners'], queryFn: (): Promise<{ at: string }> => fetchAt(), select: raw => ({ at: new Date(raw.at) }) })",
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    query: `
        (program (lexical_declaration (variable_declarator name: (identifier) @declName value: (_) @declValue) @declarator))
        (program (export_statement declaration: (lexical_declaration (variable_declarator name: (identifier) @declName value: (_) @declValue) @declarator)))
        (program (function_declaration name: (identifier) @fnName) @fnDecl)
        (program (export_statement declaration: (function_declaration name: (identifier) @fnName) @fnDecl))
        (program (interface_declaration name: (type_identifier) @typeName) @typeDecl)
        (program (export_statement declaration: (interface_declaration name: (type_identifier) @typeName) @typeDecl))
        (program (type_alias_declaration name: (type_identifier) @typeName) @typeDecl)
        (program (export_statement declaration: (type_alias_declaration name: (type_identifier) @typeName) @typeDecl))
        ((object (pair key: (property_identifier) @fnKey value: (_) @fnValue) @fnPair) @siteObject (#eq? @fnKey "queryFn"))
        ((object (shorthand_property_identifier) @fnShort) @siteObject (#eq? @fnShort "queryFn"))
        ((object (method_definition name: (property_identifier) @fnMethod) @fnMethodDef) @siteObject (#eq? @fnMethod "queryFn"))
    `,
    check(ctx, m) {
        if (m.declarator !== undefined) {
            emitDeclarator(ctx, m.declarator, m.declName!, m.declValue!)
        } else if (m.fnDecl !== undefined) {
            const array = returnedArray(ctx, m.fnDecl)
            if (array !== undefined) {
                ctx.emitFact({
                    kind: 'key-builder',
                    name: text(ctx, m.fnName!),
                    segments: segmentsOf(ctx, array),
                })
            }
        } else if (m.typeDecl !== undefined) {
            ctx.emitFact({
                kind: 'type',
                name: text(ctx, m.typeName!),
                ...summarizeDeclaration(ctx, m.typeDecl, m.typeName!),
            })
        } else if (m.fnPair !== undefined) {
            emitQuerySite(ctx, m.siteObject!, m.fnPair, m.fnValue)
        } else if (m.fnShort !== undefined) {
            emitQuerySite(ctx, m.siteObject!, m.fnShort, undefined)
        } else if (m.fnMethodDef !== undefined) {
            emitQuerySite(ctx, m.siteObject!, m.fnMethodDef, m.fnMethodDef)
        }
    },
    reduce,
})
