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

/** Hooks whose result is a network-dependent scope, deployment or device ID. */
export const SCOPE_SOURCE_HOOK =
    /^use[A-Za-z]*(Scopes?|Deployment|DeviceI[Dd]|NetworkId|Network|ChainMode)$/

export const MUTATION_CALLBACKS = [
    'mutationFn',
    'onMutate',
    'onSuccess',
    'onError',
    'onSettled',
]

const FUNCTIONS = new Set([
    'ArrowFunctionExpression',
    'FunctionExpression',
    'FunctionDeclaration',
])
const TRANSPARENT = new Set([
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
])

const propertyName = property => {
    if (property.type !== 'Property' || property.computed) return undefined
    const { key } = property
    if (key.type === 'Identifier') return key.name
    return key.type === 'Literal' ? key.value : undefined
}

// `useX(...) ?? ''` and `useX(...) as T` still bind what useX returned.
const sourceHookOf = init => {
    let expression = init
    while (expression) {
        if (expression.type === 'LogicalExpression') {
            expression = expression.left
        } else if (TRANSPARENT.has(expression.type)) {
            expression = expression.expression
        } else {
            break
        }
    }
    if (
        expression?.type === 'CallExpression' &&
        expression.callee.type === 'Identifier' &&
        SCOPE_SOURCE_HOOK.test(expression.callee.name)
    ) {
        return expression.callee.name
    }
    return undefined
}

const enclosingFunction = node => {
    for (let up = node.parent; up; up = up.parent) {
        if (FUNCTIONS.has(up.type)) return up
    }
    return undefined
}

const isInside = (identifier, fn) =>
    identifier.range[0] >= fn.range[0] && identifier.range[1] <= fn.range[1]

export const mutationScopeInVariables = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Mutation callbacks read scope, deployment and device ID from their variables, never from the enclosing hook',
        },
        messages: {
            captured:
                '{{callback}} reads {{name}} from {{hook}}() in the enclosing hook, and TanStack swaps mutation options on every render, so a network switch mid-request runs it on the new value. Pass {{name}} in the mutation variables and read it from there.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const [options] = node.arguments
                if (
                    node.callee.type !== 'Identifier' ||
                    node.callee.name !== 'useMutation' ||
                    options?.type !== 'ObjectExpression'
                ) {
                    return
                }
                const callbacks = options.properties
                    .map(property => ({
                        callback: propertyName(property),
                        fn: property.value,
                    }))
                    .filter(
                        ({ callback, fn }) =>
                            MUTATION_CALLBACKS.includes(callback) &&
                            FUNCTIONS.has(fn?.type),
                    )
                const hook = enclosingFunction(node)
                if (
                    callbacks.length === 0 ||
                    hook?.body?.type !== 'BlockStatement'
                ) {
                    return
                }
                for (const statement of hook.body.body) {
                    if (
                        statement.type !== 'VariableDeclaration' ||
                        statement.kind !== 'const'
                    ) {
                        continue
                    }
                    for (const declarator of statement.declarations) {
                        const source = sourceHookOf(declarator.init)
                        if (source === undefined) continue
                        const variables =
                            context.sourceCode.getDeclaredVariables(declarator)
                        for (const variable of variables) {
                            const reads = variable.references.filter(
                                reference => reference.isRead(),
                            )
                            for (const { callback, fn } of callbacks) {
                                const read = reads.find(reference =>
                                    isInside(reference.identifier, fn),
                                )
                                if (read === undefined) continue
                                context.report({
                                    node: read.identifier,
                                    messageId: 'captured',
                                    data: {
                                        callback,
                                        name: variable.name,
                                        hook: source,
                                    },
                                })
                            }
                        }
                    }
                }
            },
        }
    },
}
