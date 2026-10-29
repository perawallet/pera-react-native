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

const HELPER = 'getSensitiveInputProps'
const WRAPPERS = new Set([
    'ChainExpression',
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
])

const findAttribute = (element, name) =>
    element.attributes.find(
        attribute =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === name,
    )

// A bare attribute is true; only a literal {false} switches it off.
const isLiteralFalse = attribute =>
    attribute.value?.type === 'JSXExpressionContainer' &&
    attribute.value.expression.type === 'Literal' &&
    attribute.value.expression.value === false

const unwrap = node => {
    let current = node
    while (WRAPPERS.has(current.type)) current = current.expression
    return current
}

const isHelperCall = node => {
    const expression = unwrap(node)
    if (expression.type !== 'CallExpression') return false
    const callee = unwrap(expression.callee)
    if (callee.type === 'Identifier') return callee.name === HELPER
    return (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier' &&
        callee.property.name === HELPER
    )
}

// PWInput applies the helper behind `isSensitive ? helper() : undefined`, so a
// conditional branch or the right side of a logical expression counts too.
const spreadsHelper = node => {
    const expression = unwrap(node)
    if (expression.type === 'ConditionalExpression') {
        return (
            spreadsHelper(expression.consequent) ||
            spreadsHelper(expression.alternate)
        )
    }
    if (expression.type === 'LogicalExpression') {
        return spreadsHelper(expression.right)
    }
    return isHelperCall(expression)
}

export const sensitiveInputProps = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Give every secureTextEntry field the sensitive-input props',
        },
        messages: {
            missing:
                "A secureTextEntry field needs the sensitive-input props: add isSensitive (PWInput) or spread {...getSensitiveInputProps()}. A field password managers fill keeps an explicit autoComplete beside isSensitive, which wins over its 'off'.",
        },
        schema: [],
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const secure = findAttribute(node, 'secureTextEntry')
                if (!secure || isLiteralFalse(secure)) return

                const sensitive = findAttribute(node, 'isSensitive')
                if (sensitive && !isLiteralFalse(sensitive)) return

                const spreads = node.attributes.some(
                    attribute =>
                        attribute.type === 'JSXSpreadAttribute' &&
                        spreadsHelper(attribute.argument),
                )
                if (spreads) return

                context.report({ node: secure, messageId: 'missing' })
            },
        }
    },
}
