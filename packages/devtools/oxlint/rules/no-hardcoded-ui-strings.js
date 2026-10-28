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

// Digits, whitespace and punctuation alone are not copy.
const NOT_COPY = /^[0-9\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/
// A prop whose name ends in one of these carries user-facing copy.
const COPY_PROP = /(title|body|placeholder|label)$/

const URL_LIKE = /^[a-z][\w+.-]*:\/\/|^www\./i
// Two words, so `Custom Range` counts but a bare ticker or identifier does not.
const SPACED_WORDS = /\p{L}\S*\s+\S*\p{L}/u
// One capitalised word, so `Done` and `Opt-out` count but `MainNet` and `USDC` do not.
const CAPITALISED_WORD = /^\p{Lu}[\p{Ll}'’-]*\p{Ll}[.!?…:]*$/u

const TOAST_CALLEES = new Set([
    'showToast',
    'infoToast',
    'errorToast',
    'successToast',
    'showError',
])
const TOAST_COPY_KEYS = new Set(['title', 'body', 'message'])
// These hold identifiers, route names and proper nouns, which look like copy
// but are not translatable.
const NON_COPY_KEYS = new Set([
    'id',
    'key',
    'name',
    'route',
    'screen',
    'testID',
    'url',
])

const isProse = value => {
    const text = value.trim()
    if (URL_LIKE.test(text)) return false
    return SPACED_WORDS.test(text) || CAPITALISED_WORD.test(text)
}

const collapse = text => text.replace(/\s+/g, ' ').trim()

const unwrapExpression = node => {
    let current = node
    while (
        current?.type === 'TSAsExpression' ||
        current?.type === 'TSSatisfiesExpression' ||
        current?.type === 'TSTypeAssertion'
    ) {
        current = current.expression
    }
    return current
}

// Template quasis are tested one at a time so `${x}px ${y}px` is not joined
// into a false `px px`.
const proseIn = node => {
    const target = unwrapExpression(node)
    if (target?.type === 'Literal' && typeof target.value === 'string') {
        return isProse(target.value) ? collapse(target.value) : null
    }
    if (target?.type === 'TemplateLiteral') {
        for (const quasi of target.quasis) {
            const cooked = quasi.value?.cooked
            if (typeof cooked === 'string' && isProse(cooked)) {
                return collapse(cooked)
            }
        }
    }
    return null
}

const propertyName = property => {
    const { key } = property
    if (!property.computed && key?.type === 'Identifier') return key.name
    if (key?.type === 'Literal' && typeof key.value === 'string') {
        return key.value
    }
    return null
}

const toastCallee = callee => {
    if (callee?.type === 'Identifier') {
        return TOAST_CALLEES.has(callee.name) ? callee.name : null
    }
    if (
        callee?.type !== 'MemberExpression' ||
        callee.computed ||
        callee.property?.type !== 'Identifier'
    ) {
        return null
    }
    const { name } = callee.property
    if (
        name === 'alert' &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === 'Alert'
    ) {
        return 'Alert.alert'
    }
    return TOAST_CALLEES.has(name) ? name : null
}

export const noHardcodedUiStrings = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Render user-facing copy through t() rather than hardcoding it in JSX text, toasts or module-level label maps',
        },
        messages: {
            text: '"{{text}}" is hardcoded in <{{element}}>: move it into en.json and render it with t().',
            prop: '{{name}}="{{text}}" is hardcoded: move it into en.json and render it with t().',
            toast: '"{{text}}" is hardcoded in {{callee}}(): move it into en.json and pass t() instead.',
            map: '"{{text}}" is hardcoded in a module-level constant: store i18nKey(\'the.whole.key\') and render it with t().',
        },
        schema: [],
    },
    create(context) {
        const reportMapValues = node => {
            const target = unwrapExpression(node)
            if (target?.type === 'ObjectExpression') {
                for (const property of target.properties) {
                    if (property.type !== 'Property') continue
                    const name = propertyName(property)
                    if (name !== null && NON_COPY_KEYS.has(name)) continue
                    reportMapValues(property.value)
                }
                return
            }
            if (target?.type === 'ArrayExpression') {
                for (const element of target.elements) {
                    if (element) reportMapValues(element)
                }
                return
            }
            const text = proseIn(target)
            if (text !== null) {
                context.report({
                    node: target,
                    messageId: 'map',
                    data: { text },
                })
            }
        }

        const reportToastArgument = (node, callee) => {
            const target = unwrapExpression(node)
            if (target?.type === 'ObjectExpression') {
                for (const property of target.properties) {
                    if (property.type !== 'Property') continue
                    const name = propertyName(property)
                    if (name === null || !TOAST_COPY_KEYS.has(name)) continue
                    reportToastArgument(property.value, callee)
                }
                return
            }
            const text = proseIn(target)
            if (text !== null) {
                context.report({
                    node: target,
                    messageId: 'toast',
                    data: { callee, text },
                })
            }
        }

        return {
            JSXElement(node) {
                const { name } = node.openingElement
                if (
                    name.type !== 'JSXIdentifier' ||
                    !name.name.endsWith('Text')
                ) {
                    return
                }
                for (const child of node.children) {
                    if (child.type !== 'JSXText' || !isProse(child.value))
                        continue
                    context.report({
                        node,
                        messageId: 'text',
                        data: {
                            element: name.name,
                            text: collapse(child.value),
                        },
                    })
                    return
                }
            },
            JSXAttribute(node) {
                if (node.name.type !== 'JSXIdentifier') return
                const name = node.name.name
                if (!COPY_PROP.test(name)) return
                if (
                    node.value?.type !== 'Literal' ||
                    typeof node.value.value !== 'string'
                ) {
                    return
                }
                const text = node.value.value.trim()
                if (text === '' || /['"{}]/.test(text) || NOT_COPY.test(text)) {
                    return
                }
                context.report({
                    node,
                    messageId: 'prop',
                    data: { name, text },
                })
            },
            CallExpression(node) {
                const callee = toastCallee(node.callee)
                if (callee === null) return
                for (const argument of node.arguments) {
                    reportToastArgument(argument, callee)
                }
            },
            Program(node) {
                for (const statement of node.body) {
                    const declaration =
                        statement.type === 'ExportNamedDeclaration'
                            ? statement.declaration
                            : statement
                    if (
                        declaration?.type !== 'VariableDeclaration' ||
                        declaration.kind !== 'const'
                    ) {
                        continue
                    }
                    for (const declarator of declaration.declarations) {
                        const init = unwrapExpression(declarator.init)
                        if (
                            init?.type === 'ObjectExpression' ||
                            init?.type === 'ArrayExpression'
                        ) {
                            reportMapValues(init)
                        }
                    }
                }
            },
        }
    },
}
