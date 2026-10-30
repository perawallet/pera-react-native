/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { insertImportDeclaration } from '../shared/import-fix.js'

/**
 * Code that cannot import `@perawallet/wallet-core-shared`, relative to the
 * repo root. The root override lists every entry in `excludeFiles`.
 */
export const TO_ERROR_EXCLUDED_PATHS = [
    // Defines toError, and a package cannot import itself by name.
    'packages/shared/src/**',
    // wallet-core-shared depends on it, so importing shared back is a cycle.
    'packages/chain-contract/src/**',
    // wallet-core-shared depends on it, so importing shared back is a cycle.
    'packages/config/src/**',
    // Bundled alone into the sqlite Web Worker; shared's barrel would pull its whole graph in.
    'apps/browser/src/offscreen/db-worker.ts',
    // Part of the ./bootstrap entry imported before hydration; shared's barrel must stay out of that graph.
    'extensions/platform-chrome/src/storage-proxy.ts',
]

const TO_ERROR_SOURCE = '@perawallet/wallet-core-shared'
const IMPORT_TO_ERROR = `import { toError } from '${TO_ERROR_SOURCE}'`

const isPlainReference = node =>
    node.type === 'Identifier' ||
    node.type === 'ThisExpression' ||
    (node.type === 'MemberExpression' &&
        !node.computed &&
        !node.optional &&
        isPlainReference(node.object))

// Structural, so evaluating the subject once inside toError() equals
// evaluating it twice in the conditional.
const isSameReference = (a, b) => {
    if (a.type !== b.type) return false
    if (a.type === 'Identifier') return a.name === b.name
    if (a.type === 'ThisExpression') return true
    return (
        a.property.type === b.property.type &&
        a.property.name === b.property.name &&
        isSameReference(a.object, b.object)
    )
}

const isStringOf = (node, subject) =>
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'String' &&
    node.arguments.length === 1 &&
    isPlainReference(node.arguments[0]) &&
    isSameReference(node.arguments[0], subject)

// Not flagged: `new Error(x)` (undefined gives '' where String gives
// 'undefined') and `${x}` (throws on a Symbol). Neither equals toError(x).
const matchToError = node => {
    const { test, consequent, alternate } = node
    if (
        test.type !== 'BinaryExpression' ||
        test.operator !== 'instanceof' ||
        test.right.type !== 'Identifier' ||
        test.right.name !== 'Error' ||
        !isPlainReference(test.left)
    ) {
        return undefined
    }
    const subject = test.left
    if (
        isPlainReference(consequent) &&
        isSameReference(consequent, subject) &&
        alternate.type === 'NewExpression' &&
        alternate.callee.type === 'Identifier' &&
        alternate.callee.name === 'Error' &&
        alternate.arguments.length === 1 &&
        isStringOf(alternate.arguments[0], subject)
    ) {
        return { subject, form: 'error' }
    }
    if (
        consequent.type === 'MemberExpression' &&
        !consequent.computed &&
        !consequent.optional &&
        consequent.property.type === 'Identifier' &&
        consequent.property.name === 'message' &&
        isPlainReference(consequent.object) &&
        isSameReference(consequent.object, subject) &&
        isStringOf(alternate, subject)
    ) {
        return { subject, form: 'message' }
    }
    return undefined
}

const findVariable = (scope, name) => {
    for (let s = scope; s; s = s.upper) {
        const variable = s.set.get(name)
        if (variable) return variable
    }
    return undefined
}

// Configured globals have no defs; only a declaration in source shadows one.
const isDeclared = (scope, name) =>
    (findVariable(scope, name)?.defs.length ?? 0) > 0

const isSharedImport = variable =>
    variable.defs.length === 1 &&
    variable.defs[0].type === 'ImportBinding' &&
    variable.defs[0].parent.source.value === TO_ERROR_SOURCE &&
    variable.defs[0].parent.importKind !== 'type' &&
    variable.defs[0].node.importKind !== 'type'

const importFix = (fixer, program) => {
    const imports = program.body.filter(n => n.type === 'ImportDeclaration')
    const shared = imports.find(
        n =>
            n.source.value === TO_ERROR_SOURCE &&
            n.importKind !== 'type' &&
            n.specifiers.length > 0 &&
            n.specifiers.every(s => s.type === 'ImportSpecifier'),
    )
    if (shared) {
        return fixer.insertTextAfter(shared.specifiers.at(-1), ', toError')
    }

    return insertImportDeclaration(fixer, program, IMPORT_TO_ERROR)
}

export const preferToError = {
    meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: {
            description:
                'Normalise unknown errors with toError from @perawallet/wallet-core-shared',
        },
        messages: {
            error: 'This is toError({{subject}}) written out by hand: call toError from @perawallet/wallet-core-shared.',
            message:
                'This is toError({{subject}}).message written out by hand: call toError from @perawallet/wallet-core-shared.',
        },
        schema: [],
    },
    create(context) {
        const { sourceCode } = context
        return {
            ConditionalExpression(node) {
                const match = matchToError(node)
                if (!match) return
                const scope = sourceCode.getScope(node)
                if (isDeclared(scope, 'Error') || isDeclared(scope, 'String')) {
                    return
                }
                const subject = sourceCode.getText(match.subject)
                const call = `toError(${subject})`
                const replacement =
                    match.form === 'message' ? `${call}.message` : call
                const existing = findVariable(scope, 'toError')
                const hasImport =
                    existing !== undefined && isSharedImport(existing)
                // A foreign toError could be the very function being fixed; calling it from itself would recurse.
                const isForeign = isDeclared(scope, 'toError') && !hasImport

                context.report({
                    node,
                    messageId: match.form,
                    data: { subject },
                    fix: isForeign
                        ? null
                        : fixer =>
                              hasImport
                                  ? fixer.replaceText(node, replacement)
                                  : [
                                        importFix(fixer, sourceCode.ast),
                                        fixer.replaceText(node, replacement),
                                    ],
                })
            },
        }
    },
}
