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

export const noInputLabelStyle = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Style input labels only through PWInputLabel',
        },
        messages: {
            custom: "Input labels share PWInputLabel's style: pass label to PWInput, or render PWInputLabel over a field PWInput can't label. Remove this labelStyle.",
        },
        schema: [],
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                for (const attribute of node.attributes) {
                    if (
                        attribute.type === 'JSXAttribute' &&
                        attribute.name.type === 'JSXIdentifier' &&
                        attribute.name.name === 'labelStyle'
                    ) {
                        context.report({ node: attribute, messageId: 'custom' })
                    }
                }
            },
        }
    },
}
