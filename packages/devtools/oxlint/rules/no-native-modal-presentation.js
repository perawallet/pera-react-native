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

const modalPresentations = new Set([
    'modal',
    'fullScreenModal',
    'transparentModal',
    'containedModal',
    'containedTransparentModal',
    'formSheet',
    'pageSheet',
])

const isModalPresentation = value => {
    switch (value.type) {
        case 'Literal': {
            return modalPresentations.has(value.value)
        }
        case 'TemplateLiteral': {
            return (
                value.expressions.length === 0 &&
                modalPresentations.has(value.quasis[0].value.cooked)
            )
        }
        case 'ConditionalExpression': {
            return (
                isModalPresentation(value.consequent) ||
                isModalPresentation(value.alternate)
            )
        }
        case 'LogicalExpression': {
            return (
                (value.operator !== '&&' && isModalPresentation(value.left)) ||
                isModalPresentation(value.right)
            )
        }
        case 'TSAsExpression':
        case 'TSTypeAssertion':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression': {
            return isModalPresentation(value.expression)
        }
        default: {
            return false
        }
    }
}

export const noNativeModalPresentation = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Keep native navigation inside the app lock overlay',
        },
        messages: {
            modal: 'A native modal can appear above AutoLockGuard. Use an in-stack card or a sheet managed by the app.',
        },
        schema: [],
    },
    create(context) {
        return {
            Property(node) {
                const { key, value } = node
                const isPresentation =
                    (key.type === 'Identifier' &&
                        !node.computed &&
                        key.name === 'presentation') ||
                    (key.type === 'Literal' && key.value === 'presentation')
                if (isPresentation && isModalPresentation(value)) {
                    context.report({ node: value, messageId: 'modal' })
                }
            },
        }
    },
}
