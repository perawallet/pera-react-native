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

import { mentionsTypeReference } from './type-reference.js'

const SERIALIZER_TAG = 'webViewScript'
const SERIALIZER_JOIN = 'joinWebViewScripts'
const BRAND = 'WebViewScript'
const INJECT_METHOD = 'injectJavaScript'
const INJECTION_PROPS = new Set([
    'injectedJavaScript',
    'injectedJavaScriptBeforeContentLoaded',
])

const isInjectCall = callee =>
    (callee.type === 'Identifier' && callee.name === INJECT_METHOD) ||
    (callee.type === 'MemberExpression' &&
        (callee.computed
            ? callee.property.type === 'Literal' &&
              callee.property.value === INJECT_METHOD
            : callee.property.type === 'Identifier' &&
              callee.property.name === INJECT_METHOD))

const QUOTES = new Set(["'", '"', '`'])

const isIdentifierNamed = (node, name) =>
    node.type === 'Identifier' && node.name === name

export const webviewInjectionSerializer = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Build every script injected into a WebView with the webViewScript serializer',
        },
        messages: {
            unserialized:
                "{{sink}} gets a script not built by the webViewScript tag or joinWebViewScripts(): injected source runs with the page's privileges, so data may enter it only as an encoded interpolation. Build it with webViewScript from @modules/webview, or hoist a fixed script to a module-level const.",
            cast: "Casting to WebViewScript skips the serializer's encoding: build the script with the webViewScript tag.",
            quoted: 'A webViewScript interpolation is already an encoded JS expression, so wrapping it in quotes makes the payload part of the string literal and a double quote or "+x+" in it can break out. Write ${value} bare.',
        },
        schema: [],
    },
    create(context) {
        const moduleConstants = new Map()
        const resolving = new Set()

        const collectConstants = declaration => {
            if (declaration?.type !== 'VariableDeclaration') return
            if (declaration.kind !== 'const') return
            for (const declarator of declaration.declarations) {
                if (declarator.id.type === 'Identifier') {
                    moduleConstants.set(declarator.id.name, declarator.init)
                }
            }
        }

        // A module const is only as safe as its initializer: a fixed script
        // is fine, a template splicing config into one is not.
        const isSanctionedConstant = name => {
            const init = moduleConstants.get(name)
            if (!init || resolving.has(name)) return false
            resolving.add(name)
            try {
                return isSanctioned(init)
            } finally {
                resolving.delete(name)
            }
        }

        const isSanctioned = node => {
            if (node.type === 'Literal') return typeof node.value === 'string'
            if (node.type === 'TemplateLiteral') {
                return node.expressions.length === 0
            }
            if (node.type === 'TaggedTemplateExpression') {
                return isIdentifierNamed(node.tag, SERIALIZER_TAG)
            }
            if (node.type === 'CallExpression') {
                return isIdentifierNamed(node.callee, SERIALIZER_JOIN)
            }
            if (node.type === 'Identifier') {
                return (
                    node.name === 'undefined' || isSanctionedConstant(node.name)
                )
            }
            if (node.type === 'ConditionalExpression') {
                return (
                    isSanctioned(node.consequent) &&
                    isSanctioned(node.alternate)
                )
            }
            return false
        }

        const report = (node, sink) =>
            context.report({ node, messageId: 'unserialized', data: { sink } })

        const checkCast = node => {
            if (mentionsTypeReference(node.typeAnnotation, BRAND)) {
                context.report({ node, messageId: 'cast' })
            }
        }

        return {
            Program(node) {
                for (const statement of node.body) {
                    collectConstants(
                        statement.type === 'ExportNamedDeclaration'
                            ? statement.declaration
                            : statement,
                    )
                }
            },
            CallExpression(node) {
                if (!isInjectCall(node.callee)) return
                const [script] = node.arguments
                if (script && isSanctioned(script)) return
                report(node, `${INJECT_METHOD}()`)
            },
            JSXAttribute(node) {
                if (
                    node.name.type !== 'JSXIdentifier' ||
                    !INJECTION_PROPS.has(node.name.name)
                ) {
                    return
                }
                const { value } = node
                if (value?.type === 'Literal') return
                if (
                    value?.type === 'JSXExpressionContainer' &&
                    isSanctioned(value.expression)
                ) {
                    return
                }
                report(node, node.name.name)
            },
            TaggedTemplateExpression(node) {
                if (!isIdentifierNamed(node.tag, SERIALIZER_TAG)) return
                const { quasis } = node.quasi
                node.quasi.expressions.forEach((expression, index) => {
                    const before = quasis[index].value.raw.at(-1)
                    const after = quasis[index + 1].value.raw.at(0)
                    if (QUOTES.has(before) || QUOTES.has(after)) {
                        context.report({
                            node: expression,
                            messageId: 'quoted',
                        })
                    }
                })
            },
            TSAsExpression: checkCast,
            TSTypeAssertion: checkCast,
        }
    },
}
