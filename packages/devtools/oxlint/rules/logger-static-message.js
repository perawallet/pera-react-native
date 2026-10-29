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

const LOGGER_METHODS = new Set(['debug', 'info', 'warn', 'error', 'critical'])

const isStaticString = node =>
    (node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'TemplateLiteral' && node.expressions.length === 0) ||
    (node.type === 'BinaryExpression' &&
        node.operator === '+' &&
        isStaticString(node.left) &&
        isStaticString(node.right))

const isBuiltMessage = node =>
    (node.type === 'TemplateLiteral' ||
        (node.type === 'BinaryExpression' && node.operator === '+')) &&
    !isStaticString(node)

export const loggerStaticMessage = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Log a static message with per-call values in the context object',
        },
        messages: {
            builtMessage:
                "A log message built per call (template substitution or + concatenation) builds a string on every call and splits one site into many crash-report issues: pass a static message and put the values in the context object, e.g. logger.warn('Chain discovery failed', { accountId, error }).",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const { callee } = node
                if (
                    callee.type !== 'MemberExpression' ||
                    callee.computed ||
                    callee.object.type !== 'Identifier' ||
                    callee.object.name !== 'logger' ||
                    callee.property.type !== 'Identifier' ||
                    !LOGGER_METHODS.has(callee.property.name)
                ) {
                    return
                }
                const message = node.arguments[0]
                if (message && isBuiltMessage(message)) {
                    context.report({ node: message, messageId: 'builtMessage' })
                }
            },
        }
    },
}
