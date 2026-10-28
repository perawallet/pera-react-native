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

const DISPLAY_STRING_PROPERTIES = new Set(['symbol', 'unitName', 'name'])

const WRAPPERS = new Set([
    'ChainExpression',
    'TSNonNullExpression',
    'TSAsExpression',
    'TSSatisfiesExpression',
])

const unwrapExpression = node => {
    let current = node
    while (WRAPPERS.has(current.type)) {
        current = current.expression
    }
    return current
}

const CASE_NORMALISERS = new Set([
    'toUpperCase',
    'toLowerCase',
    'toLocaleUpperCase',
    'toLocaleLowerCase',
    'trim',
])

const isIdentifier = (node, name) =>
    node.type === 'Identifier' && node.name === name

const isStringLiteral = node =>
    node.type === 'Literal' && typeof node.value === 'string'

// token['symbol'] reads the same property as token.symbol
const staticPropertyName = node => {
    if (node.type !== 'MemberExpression') return undefined
    if (!node.computed) {
        return node.property.type === 'Identifier'
            ? node.property.name
            : undefined
    }
    return isStringLiteral(node.property) ? node.property.value : undefined
}

const isStaticMember = node =>
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'

const displayStringName = node => {
    const target = unwrapExpression(node)
    // Normalising case does not make display text an identity
    if (
        target.type === 'CallExpression' &&
        CASE_NORMALISERS.has(staticPropertyName(target.callee))
    ) {
        return displayStringName(target.callee.object)
    }
    if (target.type === 'LogicalExpression') {
        if (target.operator === '??' || target.operator === '||') {
            return (
                displayStringName(target.left) ??
                displayStringName(target.right)
            )
        }
        return undefined
    }
    let name
    if (target.type === 'Identifier') {
        name = target.name
    } else {
        name = staticPropertyName(target)
    }
    return name !== undefined && DISPLAY_STRING_PROPERTIES.has(name)
        ? name
        : undefined
}

const isAlgoTicker = node => {
    const target = unwrapExpression(node)
    return (
        (isStringLiteral(target) && target.value.toUpperCase() === 'ALGO') ||
        isIdentifier(target, 'ALGO_ASSET_NAME') ||
        staticPropertyName(target) === 'ALGO_ASSET_NAME'
    )
}

// An anchored pattern decides what a whole string is; an unanchored one only
// scans for substrings (log masking, error parsing), which is legitimate.
const isAnchoredAddressPattern = pattern =>
    pattern.includes('{58}') &&
    (pattern.startsWith('^') || pattern.endsWith('$'))

const regExpSource = node => {
    if (node === undefined) return undefined
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value
    }
    if (node.type === 'TemplateLiteral') {
        return node.quasis.map(quasi => quasi.value.raw).join('')
    }
    return undefined
}

const isLengthMember = node => {
    const target = unwrapExpression(node)
    return isStaticMember(target) && target.property.name === 'length'
}

const isAddressLength = node => node.type === 'Literal' && node.value === 58

export const noDisplayStringIdentity = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Decide identity by id and address validity by the chain codec, never by display text or address shape',
        },
        messages: {
            displayStringIdentity:
                '{{name}} is display text anyone can set (an ASA can name itself ALGO): decide identity by asset id, with isNativeAssetId from @perawallet/wallet-core-assets.',
            addressShape:
                'Length or alphabet never makes a string an address: check it with addressCodecs.get(chainId).isValid from @perawallet/wallet-core-chain-contract.',
        },
        schema: [],
    },
    create(context) {
        const reportRegExpSource = (node, source) => {
            if (source !== undefined && isAnchoredAddressPattern(source)) {
                context.report({ node, messageId: 'addressShape' })
            }
        }

        const checkRegExpCall = node => {
            if (isIdentifier(node.callee, 'RegExp')) {
                reportRegExpSource(node, regExpSource(node.arguments[0]))
            }
        }

        return {
            CallExpression(node) {
                const { callee } = node
                const isAlgoNameCheck =
                    isIdentifier(callee, 'isAlgoAssetName') ||
                    (isStaticMember(callee) &&
                        callee.property.name === 'isAlgoAssetName')
                if (isAlgoNameCheck) {
                    const [first] = node.arguments
                    const name =
                        first === undefined
                            ? undefined
                            : displayStringName(first)
                    if (name !== undefined) {
                        context.report({
                            node,
                            messageId: 'displayStringIdentity',
                            data: { name },
                        })
                    }
                    return
                }
                checkRegExpCall(node)
            },
            NewExpression: checkRegExpCall,
            Literal(node) {
                if (node.regex !== undefined) {
                    reportRegExpSource(node, node.regex.pattern)
                }
            },
            BinaryExpression(node) {
                const { operator, left, right } = node
                if (operator !== '===' && operator !== '!==') return

                let name
                if (isAlgoTicker(right)) {
                    name = displayStringName(left)
                } else if (isAlgoTicker(left)) {
                    name = displayStringName(right)
                }
                if (name !== undefined) {
                    context.report({
                        node,
                        messageId: 'displayStringIdentity',
                        data: { name },
                    })
                    return
                }

                if (
                    (isLengthMember(left) && isAddressLength(right)) ||
                    (isAddressLength(left) && isLengthMember(right))
                ) {
                    context.report({ node, messageId: 'addressShape' })
                }
            },
        }
    },
}
