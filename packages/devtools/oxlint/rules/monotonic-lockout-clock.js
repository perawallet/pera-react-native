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

const ARITHMETIC_OR_COMPARISON = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '**',
    '<',
    '<=',
    '>',
    '>=',
    '==',
    '!=',
    '===',
    '!==',
])
const COMPOUND_ASSIGNMENT = new Set(['+=', '-=', '*=', '/=', '%=', '**='])

const isDateNow = node =>
    node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'Date' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'now'

const isStringOperand = node =>
    node.type === 'TemplateLiteral' ||
    (node.type === 'Literal' && typeof node.value === 'string')

// `'at ' + Date.now()` builds a label, not a duration, so string concatenation passes.
const isWallClockOperand = (node, parent) => {
    if (parent?.type === 'BinaryExpression') {
        if (!ARITHMETIC_OR_COMPARISON.has(parent.operator)) return false
        if (parent.left !== node && parent.right !== node) return false
        const other = parent.left === node ? parent.right : parent.left
        return !(parent.operator === '+' && isStringOperand(other))
    }
    return (
        parent?.type === 'AssignmentExpression' &&
        COMPOUND_ASSIGNMENT.has(parent.operator) &&
        parent.right === node
    )
}

export const monotonicLockoutClock = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Time lockouts and auto-lock on the monotonic clock, never Date.now()',
        },
        messages: {
            wallClock:
                'Date.now() follows the system clock, which the user can move, so lockout, auto-lock and throttle timing must use the monotonic clock: readLockoutClocks() in packages/security, or performance.now() keyed by performance.timeOrigin in the browser vault. Recording or displaying a wall timestamp is fine.',
        },
        schema: [],
    },
    create(context) {
        const report = node => context.report({ node, messageId: 'wallClock' })
        return {
            BinaryExpression(node) {
                for (const operand of [node.left, node.right]) {
                    if (
                        isDateNow(operand) &&
                        isWallClockOperand(operand, node)
                    ) {
                        report(operand)
                    }
                }
            },
            AssignmentExpression(node) {
                if (
                    isDateNow(node.right) &&
                    isWallClockOperand(node.right, node)
                ) {
                    report(node.right)
                }
            },
            VariableDeclaration(node) {
                if (node.kind !== 'const') return
                for (const declarator of node.declarations) {
                    if (declarator.id.type !== 'Identifier') continue
                    if (!isDateNow(declarator.init)) continue
                    const variables =
                        context.sourceCode.getDeclaredVariables(declarator)
                    for (const variable of variables) {
                        for (const reference of variable.references) {
                            const { identifier } = reference
                            if (
                                reference.isRead() &&
                                isWallClockOperand(
                                    identifier,
                                    identifier.parent,
                                )
                            ) {
                                report(identifier)
                            }
                        }
                    }
                }
            },
        }
    },
}
