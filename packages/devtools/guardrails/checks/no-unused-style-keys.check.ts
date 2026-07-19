import path from 'node:path'
import ts from 'typescript'
import { getLineCol, getMakeStylesBinding } from '../utils/ast.js'
import type { Check, FinalizeContext, SourceMap } from '../types.js'

const RULE_ID = 'no-unused-style-keys'

const REMEDIATION =
    'Remove the unused style key, or reference it as styles.<key>. If the key is accessed dynamically (e.g., styles[variant]), suppress with `// guardrails-ignore-next-line no-unused-style-keys` on the line above the key.'

interface KeyDef {
    line: number
    column: number
}

interface StyleHookDef {
    file: string
    hookName: string
    keys: Map<string, KeyDef>
}

interface HookUsage {
    explicitKeys: Set<string>
    hasDynamicAccess: boolean
}

interface ImportedHook {
    hookFile: string
    hookName: string
    localName: string
}

const hookKey = (file: string, name: string): string => `${file}::${name}`

function unwrapParens(expr: ts.Expression): ts.Expression {
    let current = expr
    while (ts.isParenthesizedExpression(current)) {
        current = current.expression
    }
    return current
}

function getReturnedObjectLiteral(
    fn: ts.ArrowFunction | ts.FunctionExpression,
): ts.ObjectLiteralExpression | null {
    if (!ts.isBlock(fn.body)) {
        const unwrapped = unwrapParens(fn.body)
        return ts.isObjectLiteralExpression(unwrapped) ? unwrapped : null
    }
    for (const stmt of fn.body.statements) {
        if (ts.isReturnStatement(stmt) && stmt.expression) {
            const unwrapped = unwrapParens(stmt.expression)
            if (ts.isObjectLiteralExpression(unwrapped)) return unwrapped
        }
    }
    return null
}

function extractStyleKeys(
    call: ts.CallExpression,
    sf: ts.SourceFile,
): Map<string, KeyDef> {
    const keys = new Map<string, KeyDef>()
    const [arg] = call.arguments
    if (!arg) return keys
    if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) return keys
    const outer = getReturnedObjectLiteral(arg)
    if (!outer) return keys
    for (const prop of outer.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        let keyName: string | null = null
        if (ts.isIdentifier(prop.name)) keyName = prop.name.text
        else if (ts.isStringLiteral(prop.name)) keyName = prop.name.text
        if (keyName === null) continue
        const { line, column } = getLineCol(sf, prop.name.getStart(sf))
        keys.set(keyName, { line, column })
    }
    return keys
}

function discoverStyleHooks(sources: SourceMap): StyleHookDef[] {
    const hooks: StyleHookDef[] = []
    for (const sf of sources.values()) {
        const binding = getMakeStylesBinding(sf)
        if (!binding) continue
        for (const stmt of sf.statements) {
            if (!ts.isVariableStatement(stmt)) continue
            const isExported = stmt.modifiers?.some(
                m => m.kind === ts.SyntaxKind.ExportKeyword,
            )
            if (!isExported) continue
            for (const decl of stmt.declarationList.declarations) {
                if (!ts.isIdentifier(decl.name)) continue
                const init = decl.initializer
                if (!init || !ts.isCallExpression(init)) continue
                if (
                    !ts.isIdentifier(init.expression) ||
                    init.expression.text !== binding
                )
                    continue
                const keys = extractStyleKeys(init, sf)
                if (keys.size === 0) continue
                hooks.push({
                    file: sf.fileName,
                    hookName: decl.name.text,
                    keys,
                })
            }
        }
    }
    return hooks
}

function resolveRelativeImport(
    fromFile: string,
    specifier: string,
    sources: SourceMap,
): string | null {
    if (!specifier.startsWith('.')) return null
    const fromDir = path.dirname(fromFile)
    const base = path.resolve(fromDir, specifier)
    const candidates = [
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx'),
    ]
    for (const c of candidates) {
        if (sources.has(c)) return c
    }
    return null
}

// Metro/webpack resolve a plain `./styles` import to `styles.web.ts` at
// bundle time when building for web, transparently to the importer — so a
// key referenced via the platform-agnostic import is equally "used" in the
// `.web` sibling, if that sibling declares the same key.
function resolvePlatformVariants(
    resolvedFile: string,
    sources: SourceMap,
): string[] {
    const ext = path.extname(resolvedFile)
    const stem = resolvedFile.slice(0, -ext.length)
    if (stem.endsWith('.web')) return []
    const variant = `${stem}.web${ext}`
    return sources.has(variant) ? [variant] : []
}

function findImportedStyleHooks(
    sf: ts.SourceFile,
    sources: SourceMap,
    hookIndex: Map<string, Set<string>>,
): ImportedHook[] {
    const result: ImportedHook[] = []
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt)) continue
        const moduleSpec = stmt.moduleSpecifier
        if (!ts.isStringLiteral(moduleSpec)) continue
        const resolved = resolveRelativeImport(
            sf.fileName,
            moduleSpec.text,
            sources,
        )
        if (!resolved) continue
        const candidateFiles = [
            resolved,
            ...resolvePlatformVariants(resolved, sources),
        ]
        const bindings = stmt.importClause?.namedBindings
        if (!bindings || !ts.isNamedImports(bindings)) continue
        for (const file of candidateFiles) {
            const declaredHooks = hookIndex.get(file)
            if (!declaredHooks) continue
            for (const el of bindings.elements) {
                const original = el.propertyName?.text ?? el.name.text
                if (!declaredHooks.has(original)) continue
                result.push({
                    hookFile: file,
                    hookName: original,
                    localName: el.name.text,
                })
            }
        }
    }
    return result
}

function ensureUsage(
    file: string,
    name: string,
    map: Map<string, HookUsage>,
): HookUsage {
    const k = hookKey(file, name)
    let u = map.get(k)
    if (!u) {
        u = { explicitKeys: new Set(), hasDynamicAccess: false }
        map.set(k, u)
    }
    return u
}

function isPropertyAccessName(id: ts.Identifier): boolean {
    const p = id.parent
    return ts.isPropertyAccessExpression(p) && p.name === id
}
function isPropertyAccessSubject(id: ts.Identifier): boolean {
    const p = id.parent
    return ts.isPropertyAccessExpression(p) && p.expression === id
}
function isElementAccessSubject(id: ts.Identifier): boolean {
    const p = id.parent
    return ts.isElementAccessExpression(p) && p.expression === id
}
function isVariableNamePosition(id: ts.Identifier): boolean {
    const p = id.parent
    return ts.isVariableDeclaration(p) && p.name === id
}

function usagesFor(
    hooks: ImportedHook[],
    out: Map<string, HookUsage>,
): HookUsage[] {
    return hooks.map(hook => ensureUsage(hook.hookFile, hook.hookName, out))
}

function recordConsumerUsage(
    consumer: ts.SourceFile,
    imported: ImportedHook[],
    out: Map<string, HookUsage>,
): void {
    const localToHooks = new Map<string, ImportedHook[]>()
    for (const h of imported) {
        const list = localToHooks.get(h.localName) ?? []
        list.push(h)
        localToHooks.set(h.localName, list)
    }

    const stylesVarToHooks = new Map<string, ImportedHook[]>()

    const collectBindings = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && node.initializer) {
            const init = node.initializer
            if (
                ts.isCallExpression(init) &&
                ts.isIdentifier(init.expression) &&
                localToHooks.has(init.expression.text)
            ) {
                const hooks = localToHooks.get(init.expression.text)!
                const usages = usagesFor(hooks, out)
                if (ts.isIdentifier(node.name)) {
                    stylesVarToHooks.set(node.name.text, hooks)
                } else if (ts.isObjectBindingPattern(node.name)) {
                    for (const el of node.name.elements) {
                        if (!ts.isBindingElement(el)) continue
                        if (el.dotDotDotToken) {
                            usages.forEach(u => (u.hasDynamicAccess = true))
                            continue
                        }
                        const propName = el.propertyName ?? el.name
                        if (ts.isIdentifier(propName)) {
                            usages.forEach(u =>
                                u.explicitKeys.add(propName.text),
                            )
                        } else if (ts.isStringLiteral(propName)) {
                            usages.forEach(u =>
                                u.explicitKeys.add(propName.text),
                            )
                        } else {
                            usages.forEach(u => (u.hasDynamicAccess = true))
                        }
                    }
                } else {
                    usages.forEach(u => (u.hasDynamicAccess = true))
                }
            }
        }
        ts.forEachChild(node, collectBindings)
    }
    collectBindings(consumer)

    if (stylesVarToHooks.size === 0) return

    const collectRefs = (node: ts.Node): void => {
        if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            stylesVarToHooks.has(node.expression.text)
        ) {
            const usages = usagesFor(
                stylesVarToHooks.get(node.expression.text)!,
                out,
            )
            if (ts.isIdentifier(node.name)) {
                usages.forEach(u => u.explicitKeys.add(node.name.text))
            } else {
                usages.forEach(u => (u.hasDynamicAccess = true))
            }
            return
        }
        if (
            ts.isElementAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            stylesVarToHooks.has(node.expression.text)
        ) {
            const usages = usagesFor(
                stylesVarToHooks.get(node.expression.text)!,
                out,
            )
            const arg = node.argumentExpression
            if (ts.isStringLiteral(arg)) {
                usages.forEach(u => u.explicitKeys.add(arg.text))
            } else {
                usages.forEach(u => (u.hasDynamicAccess = true))
            }
            return
        }
        if (
            ts.isSpreadAssignment(node) &&
            ts.isIdentifier(node.expression) &&
            stylesVarToHooks.has(node.expression.text)
        ) {
            usagesFor(stylesVarToHooks.get(node.expression.text)!, out).forEach(
                u => (u.hasDynamicAccess = true),
            )
            return
        }
        if (
            ts.isSpreadElement(node) &&
            ts.isIdentifier(node.expression) &&
            stylesVarToHooks.has(node.expression.text)
        ) {
            usagesFor(stylesVarToHooks.get(node.expression.text)!, out).forEach(
                u => (u.hasDynamicAccess = true),
            )
            return
        }
        if (
            ts.isIdentifier(node) &&
            stylesVarToHooks.has(node.text) &&
            !isPropertyAccessSubject(node) &&
            !isElementAccessSubject(node) &&
            !isVariableNamePosition(node) &&
            !isPropertyAccessName(node)
        ) {
            usagesFor(stylesVarToHooks.get(node.text)!, out).forEach(
                u => (u.hasDynamicAccess = true),
            )
        }
        ts.forEachChild(node, collectRefs)
    }
    collectRefs(consumer)
}

const check: Check = {
    id: RULE_ID,
    description:
        'Detect makeStyles keys that are never referenced by any consumer.',
    visitors: {},
    finalize: (ctx: FinalizeContext) => {
        const { sources, emit } = ctx

        const allHooks = discoverStyleHooks(sources)
        if (allHooks.length === 0) return

        const hookIndex = new Map<string, Set<string>>()
        for (const h of allHooks) {
            const set = hookIndex.get(h.file) ?? new Set<string>()
            set.add(h.hookName)
            hookIndex.set(h.file, set)
        }

        const usage = new Map<string, HookUsage>()
        for (const sf of sources.values()) {
            const imported = findImportedStyleHooks(sf, sources, hookIndex)
            if (imported.length === 0) continue
            recordConsumerUsage(sf, imported, usage)
        }

        for (const def of allHooks) {
            const u = usage.get(hookKey(def.file, def.hookName))
            if (u && u.hasDynamicAccess) continue
            const used = u?.explicitKeys ?? new Set<string>()
            for (const [keyName, pos] of def.keys) {
                if (used.has(keyName)) continue
                emit({
                    file: def.file,
                    line: pos.line,
                    column: pos.column,
                    message: `style key "${keyName}" in ${def.hookName} is never referenced`,
                    remediation: REMEDIATION,
                })
            }
        }
    },
}

export default check
