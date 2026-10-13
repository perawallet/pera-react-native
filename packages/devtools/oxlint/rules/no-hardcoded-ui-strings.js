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

export const noHardcodedUiStrings = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Render user-facing copy through t() rather than hardcoding it',
        },
        messages: {
            text: '"{{text}}" is hardcoded in <Text>: move it into en.json and render it with t().',
            prop: '{{name}}="{{text}}" is hardcoded: move it into en.json and render it with t().',
        },
        schema: [],
    },
    create(context) {
        return {
            JSXElement(node) {
                const { name } = node.openingElement
                if (name.type !== 'JSXIdentifier' || name.name !== 'Text') return
                if (
                    node.children.length === 0 ||
                    node.children.some(child => child.type !== 'JSXText')
                ) {
                    return
                }
                const text = node.children
                    .map(child => child.value)
                    .join('')
                    .trim()
                if (NOT_COPY.test(text)) return
                context.report({ node, messageId: 'text', data: { text } })
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
                context.report({ node, messageId: 'prop', data: { name, text } })
            },
        }
    },
}
