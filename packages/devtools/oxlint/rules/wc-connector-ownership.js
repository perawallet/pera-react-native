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

/** The files allowed to construct a WalletConnect v1 connector or the registry that holds them. */
export const WC_CONNECTOR_OWNERS = [
    'packages/walletconnect/src/connection/createConnector.ts',
    'packages/walletconnect/src/connection/connectorRegistry.ts',
    'packages/walletconnect/src/v1/handler.ts',
    'packages/walletconnect/src/v1/restore.ts',
]

const CONNECTOR_CALLS = new Set([
    'createWalletConnectConnector',
    'createConnectorRegistry',
    'useWalletConnect',
])

const calleeName = callee => {
    if (callee.type === 'Identifier') return callee.name
    if (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier'
    ) {
        return callee.property.name
    }
    return undefined
}

export const wcConnectorOwnership = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Only the WalletConnect connection layer owns a v1 connector',
        },
        messages: {
            owner: '{{name}} creates a WalletConnect v1 connector or its registry outside the connection layer: connectors are v1 handler state, and on web only the offscreen document\'s handler holds live ones.',
        },
        schema: [],
    },
    create(context) {
        return {
            NewExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'WalletConnect'
                ) {
                    context.report({
                        node,
                        messageId: 'owner',
                        data: { name: 'new WalletConnect' },
                    })
                }
            },
            CallExpression(node) {
                const name = calleeName(node.callee)
                if (name === undefined || !CONNECTOR_CALLS.has(name)) return
                context.report({ node, messageId: 'owner', data: { name } })
            },
        }
    },
}
