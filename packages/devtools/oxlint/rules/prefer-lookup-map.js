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

const MIN_CASES = 3

const caseBody = consequent =>
    consequent.length === 1 && consequent[0].type === 'BlockStatement'
        ? consequent[0].body
        : consequent

const rootName = expression => {
    let current = expression
    while (current) {
        if (current.type === 'ChainExpression') current = current.expression
        else if (current.type === 'MemberExpression') current = current.object
        else break
    }
    return current?.type === 'Identifier' ? current.name : null
}

const isStaticMember = (node, excludedRoot) => {
    let current = node.type === 'ChainExpression' ? node.expression : node
    if (current.type !== 'MemberExpression') return false
    while (current.type === 'MemberExpression') {
        if (current.computed) return false
        current = current.object
        if (current.type === 'ChainExpression') current = current.expression
    }
    return current.type === 'Identifier' && current.name !== excludedRoot
}

const isConstantValue = (argument, discriminantRoot) => {
    // A regex literal is a fresh object per evaluation; a shared map entry would share its lastIndex.
    if (argument.type === 'Literal') return !argument.regex
    if (argument.type === 'CallExpression') {
        return (
            argument.callee.type === 'Identifier' &&
            argument.callee.name === 't' &&
            argument.arguments.length === 1 &&
            argument.arguments[0].type === 'Literal' &&
            typeof argument.arguments[0].value === 'string'
        )
    }
    return isStaticMember(argument, discriminantRoot)
}

const isNullish = argument =>
    (argument.type === 'Literal' &&
        argument.value === null &&
        !argument.regex) ||
    (argument.type === 'Identifier' && argument.name === 'undefined')

// A keyed case returning null or undefined cannot sit beside a default:
// `map[k] ?? fallback` would send that key to the fallback. The default's own
// nullish value is safe.
const nullishKeyedCaseBesideDefault = cases => {
    if (!cases.some(c => c.test === null)) return false
    let groupHasDefault = false
    for (const c of cases) {
        if (c.test === null) groupHasDefault = true
        if (c.consequent.length === 0) continue
        const [statement] = caseBody(c.consequent)
        if (!groupHasDefault && isNullish(statement.argument)) return true
        groupHasDefault = false
    }
    return false
}

const isKeyTest = test =>
    test === null || test.type === 'Literal' || isStaticMember(test, null)

export const preferLookupMap = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Turn a switch that only returns constants into a typed Record lookup',
        },
        messages: {
            lookup: 'Every case of this switch only returns a constant: declare a typed Record<Union, Value> and look the value up. Turn a default branch into `map[k] ?? fallback`, or `Object.hasOwn(map, k) ? map[k] : fallback` when the key can be a string outside the union, so an Object.prototype key such as `constructor` misses.',
        },
        schema: [],
    },
    create(context) {
        return {
            SwitchStatement(node) {
                const filled = node.cases.filter(c => c.consequent.length > 0)
                if (filled.length < MIN_CASES) return
                if (!node.cases.every(c => isKeyTest(c.test))) return

                // A member read off the switched value depends on which variant matched, so no map can hold it.
                const discriminantRoot = rootName(node.discriminant)
                const onlyConstantReturns = filled.every(c => {
                    const body = caseBody(c.consequent)
                    return (
                        body.length === 1 &&
                        body[0].type === 'ReturnStatement' &&
                        body[0].argument !== null &&
                        isConstantValue(body[0].argument, discriminantRoot)
                    )
                })
                if (
                    onlyConstantReturns &&
                    !nullishKeyedCaseBesideDefault(node.cases)
                ) {
                    context.report({ node, messageId: 'lookup' })
                }
            },
        }
    },
}
