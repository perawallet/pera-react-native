import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import type { Check } from '../types.js'

const RULE_ID = 'no-error-toast-in-catch'

const REMEDIATION =
    'Use showError(error, fallbackTitle) from useErrorToast (apps/mobile/src/hooks/useErrorToast.ts) instead of showToast({ type: "error", ... }) when surfacing a caught exception.'

const EXEMPT_PATH = '/apps/mobile/src/hooks/useErrorToast'

function isShowToastCall(call: ts.CallExpression): boolean {
    return (
        ts.isIdentifier(call.expression) && call.expression.text === 'showToast'
    )
}

function hasErrorTypeArg(call: ts.CallExpression): boolean {
    const first = call.arguments[0]
    if (!first || !ts.isObjectLiteralExpression(first)) return false
    for (const prop of first.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const propName = ts.isIdentifier(prop.name)
            ? prop.name.text
            : ts.isStringLiteral(prop.name)
              ? prop.name.text
              : null
        if (propName !== 'type') continue
        const init = prop.initializer
        if (ts.isStringLiteral(init) && init.text === 'error') return true
    }
    return false
}

function isCatchCallback(fn: ts.Node): boolean {
    const parent = fn.parent
    if (!parent || !ts.isCallExpression(parent)) return false
    if (parent.arguments[0] !== fn) return false
    const callee = parent.expression
    return ts.isPropertyAccessExpression(callee) && callee.name.text === 'catch'
}

function isInsideCatchScope(node: ts.Node): boolean {
    let cur: ts.Node | undefined = node.parent
    while (cur) {
        if (ts.isCatchClause(cur)) return true
        if (ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) {
            if (isCatchCallback(cur)) return true
            return false
        }
        if (
            ts.isFunctionDeclaration(cur) ||
            ts.isMethodDeclaration(cur) ||
            ts.isConstructorDeclaration(cur) ||
            ts.isGetAccessorDeclaration(cur) ||
            ts.isSetAccessorDeclaration(cur) ||
            ts.isSourceFile(cur)
        ) {
            return false
        }
        cur = cur.parent
    }
    return false
}

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow showToast({ type: "error", ... }) inside catch blocks or .catch(...) handlers. Use showError() from useErrorToast.',
    visitors: {
        [ts.SyntaxKind.CallExpression]: (node, sf, emit) => {
            if (sf.fileName.includes(EXEMPT_PATH)) return
            const call = node as ts.CallExpression
            if (!isShowToastCall(call)) return
            if (!hasErrorTypeArg(call)) return
            if (!isInsideCatchScope(call)) return
            const { line, column } = getLineCol(sf, call.getStart(sf))
            emit({
                line,
                column,
                message:
                    'showToast({ type: "error", ... }) inside a catch block — use showError() from useErrorToast instead',
                remediation: REMEDIATION,
            })
        },
    },
}

export default check
