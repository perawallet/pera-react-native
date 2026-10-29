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

export const testIdProp = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Pass testID to a component instead of spreading getTestProps outside components/core',
        },
        messages: {
            spread: 'Pass testID to the element instead of spreading getTestProps(…): core components and React Native primitives map it to automation props. Give a Pera component a testID prop if it lacks one, and pass a suffixed ID as testID={id && `${id}_suffix`}.',
        },
        schema: [],
    },
    create(context) {
        return {
            JSXSpreadAttribute(node) {
                const arg = node.argument
                if (arg.type !== 'CallExpression') {
                    return
                }
                const callee = arg.callee
                const isGetTestProps =
                    (callee.type === 'Identifier' &&
                        callee.name === 'getTestProps') ||
                    (callee.type === 'MemberExpression' &&
                        !callee.computed &&
                        callee.property.name === 'getTestProps')
                if (isGetTestProps) {
                    context.report({ node, messageId: 'spread' })
                }
            },
        }
    },
}
