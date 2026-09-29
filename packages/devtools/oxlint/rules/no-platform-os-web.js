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

const isPlatformOs = node =>
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'Platform' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'OS'

const isWebLiteral = node => node?.type === 'Literal' && node.value === 'web'

const EQUALITY_OPERATORS = new Set(['===', '!==', '==', '!='])

export const noPlatformOsWeb = {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Gate web differences on routeCapabilities or a .web.ts twin, not Platform.OS === 'web'",
        },
        messages: {
            web: "Don't branch on Platform.OS === 'web': gate a product capability on routeCapabilities (routes/capabilities-types.ts), or move a rendering/implementation difference into a .web.ts(x) twin.",
        },
        schema: [],
    },
    create(context) {
        return {
            BinaryExpression(node) {
                if (!EQUALITY_OPERATORS.has(node.operator)) return
                const isMatch =
                    (isPlatformOs(node.left) && isWebLiteral(node.right)) ||
                    (isPlatformOs(node.right) && isWebLiteral(node.left))
                if (isMatch) context.report({ node, messageId: 'web' })
            },
            SwitchStatement(node) {
                if (!isPlatformOs(node.discriminant)) return
                for (const switchCase of node.cases) {
                    if (isWebLiteral(switchCase.test)) {
                        context.report({ node: switchCase, messageId: 'web' })
                    }
                }
            },
        }
    },
}
