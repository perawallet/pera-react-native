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

// Build-time config (`config.supportBaseUrl`, `config.x.y`) is trusted; any
// other non-constant argument may be peer-, backend- or metadata-supplied.
// A const from `toValidatedBrowserUrl`, or `withLanguageParam` over a trusted
// base, is trusted too; the const lookup is same-file only.
const VALIDATORS = new Set(['toValidatedBrowserUrl'])
const URL_BUILDERS = new Set(['withLanguageParam'])
const CALL_SINKS = new Set(['pushWebView', 'openSystemBrowser'])
const WEBVIEW_URL_ATTRIBUTE = {
    WebView: 'source',
    PWStaticWebView: 'source',
    PWWebView: 'url',
}
const MAX_DEPTH = 5

const isConfigMember = node => {
    let current = node
    while (current.type === 'MemberExpression') current = current.object
    return current.type === 'Identifier' && current.name === 'config'
}

const constInit = (identifier, sourceCode) => {
    let scope = sourceCode.getScope(identifier)
    while (scope) {
        const variable = scope.set.get(identifier.name)
        if (variable) {
            if (variable.defs.length !== 1) return null
            const [def] = variable.defs
            const isConst =
                def.type === 'Variable' &&
                def.parent?.kind === 'const' &&
                def.node.id.type === 'Identifier'
            return isConst ? (def.node.init ?? null) : null
        }
        scope = scope.upper
    }
    return null
}

const isTrustedUrl = (node, sourceCode, depth = 0) => {
    if (depth > MAX_DEPTH) return false
    if (
        (node.type === 'Literal' && typeof node.value === 'string') ||
        (node.type === 'TemplateLiteral' && node.expressions.length === 0) ||
        (node.type === 'MemberExpression' && isConfigMember(node))
    ) {
        return true
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        if (VALIDATORS.has(node.callee.name)) return true
        const [base] = node.arguments
        return (
            URL_BUILDERS.has(node.callee.name) &&
            !!base &&
            isTrustedUrl(base, sourceCode, depth + 1)
        )
    }
    if (
        node.type === 'LogicalExpression' &&
        (node.operator === '??' || node.operator === '||')
    ) {
        return (
            isTrustedUrl(node.left, sourceCode, depth + 1) &&
            isTrustedUrl(node.right, sourceCode, depth + 1)
        )
    }
    if (node.type === 'Identifier') {
        const init = constInit(node, sourceCode)
        return !!init && isTrustedUrl(init, sourceCode, depth + 1)
    }
    return false
}

const isLinkingOpenUrl = callee =>
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Linking' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'openURL'

const callSinkName = callee => {
    if (callee.type === 'Identifier' && CALL_SINKS.has(callee.name)) {
        return callee.name
    }
    if (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier' &&
        CALL_SINKS.has(callee.property.name)
    ) {
        return callee.property.name
    }
    return null
}

const propertyNamed = (object, name) =>
    object.properties.find(
        property =>
            property.type === 'Property' &&
            !property.computed &&
            ((property.key.type === 'Identifier' &&
                property.key.name === name) ||
                (property.key.type === 'Literal' &&
                    property.key.value === name)),
    )

const sinkUrl = argument => {
    if (!argument) return null
    if (argument.type !== 'ObjectExpression') return argument
    return propertyNamed(argument, 'url')?.value ?? null
}

const attributeExpression = attribute => {
    const { value } = attribute
    return value?.type === 'JSXExpressionContainer' ? value.expression : value
}

const isString = (node, expected) =>
    node?.type === 'Literal' && node.value === expected

export const noUnvalidatedOpenUrl = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Route non-constant URLs through toValidatedBrowserUrl before any browser or WebView sink, and keep WebView origin and mixed-content guards on',
        },
        messages: {
            unvalidated:
                "{{sink}} with a URL that is not a literal, a config.* value or a const from toValidatedBrowserUrl: route it through toValidatedBrowserUrl (openValidatedBrowserUrl for the system browser), or disable with a '-- reason' naming why it is app-controlled.",
            wildcardOrigin:
                "originWhitelist '*' on {{component}} lets any scheme load: use 'https://*', or disable with a '-- reason' naming what decides each navigation.",
            mixedContentAlways:
                "mixedContentMode='always' on {{component}} lets an https page load http content: remove it, or disable with a '-- reason'.",
        },
        schema: [],
    },
    create(context) {
        const { sourceCode } = context

        const checkJsxUrl = (attribute, component) => {
            const expression = attributeExpression(attribute)
            if (!expression) return
            const attributeName = WEBVIEW_URL_ATTRIBUTE[component]
            const sink = `<${component} ${attributeName}>`
            let url = expression
            if (attributeName === 'source') {
                if (expression.type !== 'ObjectExpression') {
                    context.report({
                        node: attribute,
                        messageId: 'unvalidated',
                        data: { sink },
                    })
                    return
                }
                url = propertyNamed(expression, 'uri')?.value
                if (!url) return
            }
            if (!isTrustedUrl(url, sourceCode)) {
                context.report({
                    node: attribute,
                    messageId: 'unvalidated',
                    data: { sink },
                })
            }
        }

        return {
            CallExpression(node) {
                if (isLinkingOpenUrl(node.callee)) {
                    const [argument] = node.arguments
                    if (argument && isTrustedUrl(argument, sourceCode)) return
                    context.report({
                        node,
                        messageId: 'unvalidated',
                        data: { sink: 'Linking.openURL' },
                    })
                    return
                }
                const sink = callSinkName(node.callee)
                if (!sink) return
                const url = sinkUrl(node.arguments[0])
                if (url && isTrustedUrl(url, sourceCode)) return
                context.report({
                    node,
                    messageId: 'unvalidated',
                    data: { sink },
                })
            },
            JSXOpeningElement(node) {
                if (node.name.type !== 'JSXIdentifier') return
                const component = node.name.name
                if (!Object.hasOwn(WEBVIEW_URL_ATTRIBUTE, component)) return
                for (const attribute of node.attributes) {
                    if (
                        attribute.type !== 'JSXAttribute' ||
                        attribute.name.type !== 'JSXIdentifier'
                    ) {
                        continue
                    }
                    const { name } = attribute.name
                    const expression = attributeExpression(attribute)
                    if (name === WEBVIEW_URL_ATTRIBUTE[component]) {
                        checkJsxUrl(attribute, component)
                    } else if (
                        name === 'originWhitelist' &&
                        expression?.type === 'ArrayExpression' &&
                        expression.elements.some(element =>
                            isString(element, '*'),
                        )
                    ) {
                        context.report({
                            node: attribute,
                            messageId: 'wildcardOrigin',
                            data: { component },
                        })
                    } else if (
                        name === 'mixedContentMode' &&
                        isString(expression, 'always')
                    ) {
                        context.report({
                            node: attribute,
                            messageId: 'mixedContentAlways',
                            data: { component },
                        })
                    }
                }
            },
        }
    },
}
