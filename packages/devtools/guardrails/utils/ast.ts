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

function getNamedImports(
    node: ts.ImportDeclaration,
): ts.NamedImports | null {
    const bindings = node.importClause?.namedBindings
    if (!bindings) return null
    if (!ts.isNamedImports(bindings)) return null
    return bindings
}

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

function extractObjectLiteralFromCallback(
    callback: ts.ArrowFunction | ts.FunctionExpression,
): ts.ObjectLiteralExpression | null {
    const body = callback.body
    if (ts.isObjectLiteralExpression(body)) {
        return body
    }
    if (ts.isBlock(body)) {
        for (const statement of body.statements) {
            if (
                ts.isReturnStatement(statement) &&
                statement.expression &&
                ts.isObjectLiteralExpression(statement.expression)
            ) {
                return statement.expression
            }
        }
    }
    return null
}

function getMakeStylesCallback(
    call: ts.CallExpression,
): ts.ArrowFunction | ts.FunctionExpression | null {
    const first = call.arguments[0]
    if (!first) return null
    if (ts.isArrowFunction(first) || ts.isFunctionExpression(first)) {
        return first
    }
    return null
}

export function forEachMakeStylesStyleObject(
    sf: ts.SourceFile,
    cb: (
        styleEntry: ts.ObjectLiteralExpression,
        makeStylesCall: ts.CallExpression,
    ) => void,
): void {
    const localName = resolveNamedImport(sf, '@rneui/themed', 'makeStyles')
    if (!localName) return

    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === localName
        ) {
            const callback = getMakeStylesCallback(node)
            if (callback) {
                const outer = extractObjectLiteralFromCallback(callback)
                if (outer) {
                    for (const prop of outer.properties) {
                        if (
                            ts.isPropertyAssignment(prop) &&
                            ts.isObjectLiteralExpression(prop.initializer)
                        ) {
                            cb(prop.initializer, node)
                        }
                    }
                }
            }
        }
        ts.forEachChild(node, visit)
    }

    visit(sf)
}
