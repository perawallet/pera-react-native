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

const isTen = node =>
    node.type === 'Literal' && (node.value === 10 || node.bigint === '10')

const isIdentifier = (node, name) =>
    node.type === 'Identifier' && node.name === name

const isStaticMember = node =>
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'

const isMember = (node, objectName, propertyName) =>
    isStaticMember(node) &&
    isIdentifier(node.object, objectName) &&
    node.property.name === propertyName

const isNewDecimalOfTen = node =>
    node.type === 'NewExpression' &&
    isIdentifier(node.callee, 'Decimal') &&
    node.arguments.length > 0 &&
    isTen(node.arguments[0])

const unitConstantName = node => {
    let name
    if (node.type === 'Identifier') {
        name = node.name
    } else if (isStaticMember(node)) {
        name = node.property.name
    }
    return name !== undefined &&
        (name === 'MICRO_ALGO_DIVISOR' || /_DECIMALS$/.test(name))
        ? name
        : undefined
}

const ARITHMETIC_METHODS = new Set(['mul', 'times', 'div', 'dividedBy'])

const isStringForm = arg => {
    if (arg.type === 'CallExpression') {
        return (
            isIdentifier(arg.callee, 'String') ||
            (isStaticMember(arg.callee) &&
                arg.callee.property.name === 'toString')
        )
    }
    return (
        arg.type === 'TemplateLiteral' &&
        arg.expressions.length === 1 &&
        arg.quasis.every(quasi => quasi.value.raw === '')
    )
}

export const noManualUnitConversion = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Convert units with the shared helpers, never by hand',
        },
        messages: {
            powerOfTen:
                'A hand-built power of ten converts units outside the helpers: use baseUnitsToDisplayUnits / displayUnitsToBaseUnits (or microAlgosToAlgos, algosToMicroAlgosBigInt) from @perawallet/wallet-core-shared, or toWholeUnits / toDecimalUnits from @perawallet/wallet-core-assets.',
            unitConstant:
                '{{name}} as a multiplier or divisor converts units by hand: use baseUnitsToDisplayUnits / displayUnitsToBaseUnits (or microAlgosToAlgos, algosToMicroAlgosBigInt) from @perawallet/wallet-core-shared.',
            stringBigInt:
                'BigInt from a number\'s string form throws on exponent notation (BigInt("1e+21")): use toBigInt from @perawallet/wallet-core-shared.',
        },
        schema: [],
    },
    create(context) {
        const reportUnitConstant = (node, operand) => {
            const name = unitConstantName(operand)
            if (name === undefined) return false
            context.report({ node, messageId: 'unitConstant', data: { name } })
            return true
        }

        return {
            CallExpression(node) {
                const { callee } = node
                const [first] = node.arguments

                if (
                    first !== undefined &&
                    (isMember(callee, 'Math', 'pow') ||
                        isMember(callee, 'Decimal', 'pow')) &&
                    isTen(first)
                ) {
                    context.report({ node, messageId: 'powerOfTen' })
                    return
                }

                if (isStaticMember(callee)) {
                    if (
                        callee.property.name === 'pow' &&
                        isNewDecimalOfTen(callee.object)
                    ) {
                        context.report({ node, messageId: 'powerOfTen' })
                    } else if (ARITHMETIC_METHODS.has(callee.property.name)) {
                        const operand = node.arguments.find(
                            arg => unitConstantName(arg) !== undefined,
                        )
                        if (operand !== undefined) {
                            reportUnitConstant(node, operand)
                        }
                    }
                    return
                }

                if (
                    isIdentifier(callee, 'BigInt') &&
                    first !== undefined &&
                    isStringForm(first)
                ) {
                    context.report({ node, messageId: 'stringBigInt' })
                }
            },
            BinaryExpression(node) {
                if (node.operator === '**' && isTen(node.left)) {
                    context.report({ node, messageId: 'powerOfTen' })
                } else if (node.operator === '*' || node.operator === '/') {
                    if (!reportUnitConstant(node, node.left)) {
                        reportUnitConstant(node, node.right)
                    }
                }
            },
            AssignmentExpression(node) {
                if (node.operator === '*=' || node.operator === '/=') {
                    reportUnitConstant(node, node.right)
                }
            },
        }
    },
}
