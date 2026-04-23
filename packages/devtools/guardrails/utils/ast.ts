import ts from 'typescript'

export function getLineCol(
    sf: ts.SourceFile,
    pos: number,
): { line: number; column: number } {
    const { line, character } = ts.getLineAndCharacterOfPosition(sf, pos)
    return { line: line + 1, column: character + 1 }
}

function isImportFromModule(
    node: ts.Node,
    moduleSpecifier: string,
): node is ts.ImportDeclaration {
    if (!ts.isImportDeclaration(node)) return false
    const spec = node.moduleSpecifier
    if (!ts.isStringLiteral(spec)) return false
    return spec.text === moduleSpecifier
}

function getNamedImports(node: ts.ImportDeclaration): ts.NamedImports | null {
    const bindings = node.importClause?.namedBindings
    if (!bindings) return null
    if (!ts.isNamedImports(bindings)) return null
    return bindings
}

/** Returns the local identifier bound to the given imported name from `moduleSpecifier`, or null if not imported. */
export function resolveNamedImport(
    sf: ts.SourceFile,
    moduleSpecifier: string,
    importedName: string,
): string | null {
    for (const statement of sf.statements) {
        if (!isImportFromModule(statement, moduleSpecifier)) continue
        const named = getNamedImports(statement)
        if (!named) continue
        for (const element of named.elements) {
            const original = element.propertyName?.text ?? element.name.text
            if (original === importedName) {
                return element.name.text
            }
        }
    }
    return null
}

/** Returns a map of local-identifier → imported-name for all named imports from `moduleSpecifier`. */
export function resolveModuleBindings(
    sf: ts.SourceFile,
    moduleSpecifier: string,
): Map<string, string> {
    const result = new Map<string, string>()
    for (const statement of sf.statements) {
        if (!isImportFromModule(statement, moduleSpecifier)) continue
        const named = getNamedImports(statement)
        if (!named) continue
        for (const element of named.elements) {
            const original = element.propertyName?.text ?? element.name.text
            result.set(element.name.text, original)
        }
    }
    return result
}

const makeStylesBindingCache = new WeakMap<ts.SourceFile, string | null>()

/**
 * Returns the local identifier name bound to `makeStyles` from `@rneui/themed`
 * in the given SourceFile. Result is memoized per SourceFile.
 */
export function getMakeStylesBinding(sf: ts.SourceFile): string | null {
    if (makeStylesBindingCache.has(sf)) {
        return makeStylesBindingCache.get(sf) ?? null
    }
    const binding = resolveNamedImport(sf, '@rneui/themed', 'makeStyles')
    makeStylesBindingCache.set(sf, binding)
    return binding
}

function unwrapParens(expr: ts.Expression): ts.Expression {
    let current = expr
    while (ts.isParenthesizedExpression(current)) {
        current = current.expression
    }
    return current
}

function getCallbackBodyObjectLiteral(
    callback: ts.ArrowFunction | ts.FunctionExpression,
): ts.ObjectLiteralExpression | null {
    const body = callback.body
    if (!ts.isBlock(body)) {
        const unwrapped = unwrapParens(body)
        return ts.isObjectLiteralExpression(unwrapped) ? unwrapped : null
    }
    for (const statement of body.statements) {
        if (ts.isReturnStatement(statement) && statement.expression) {
            const unwrapped = unwrapParens(statement.expression)
            if (ts.isObjectLiteralExpression(unwrapped)) return unwrapped
        }
    }
    return null
}

/**
 * Given a CallExpression that is confirmed to be `makeStyles(...)`, invoke cb
 * for each top-level style-entry ObjectLiteralExpression inside the returned
 * object. Example: `makeStyles(theme => ({ root: { padding: 12 } }))` yields
 * the inner `{ padding: 12 }` once.
 */
export function descendMakeStylesCall(
    call: ts.CallExpression,
    cb: (styleEntry: ts.ObjectLiteralExpression) => void,
): void {
    const [arg] = call.arguments
    if (!arg) return
    if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) return
    const outer = getCallbackBodyObjectLiteral(arg)
    if (!outer) return
    for (const prop of outer.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const value = prop.initializer
        if (ts.isObjectLiteralExpression(value)) cb(value)
    }
}
