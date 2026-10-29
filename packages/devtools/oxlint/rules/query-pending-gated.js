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

const GATED_QUERY_HOOKS = ['useQuery', 'useInfiniteQuery']

// isLoading is deliberately not checked: v5 defines it as isPending &&
// isFetching, so it is already false while a query is disabled or paused.

const FUNCTION_TYPES = [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]
const TRANSPARENT_TYPES = [
    'LogicalExpression',
    'ConditionalExpression',
    'UnaryExpression',
    'BinaryExpression',
    'ChainExpression',
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
]
const TYPE_WRAPPERS = [
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
]
const SKIPPED_KEYS = ['parent', 'loc', 'range']
const POSITION_KEYS = [...SKIPPED_KEYS, 'start', 'end', 'raw']

const childNodes = node => {
    const children = []
    for (const key of Object.keys(node)) {
        if (SKIPPED_KEYS.includes(key)) continue
        const value = node[key]
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child && typeof child === 'object' && 'type' in child) {
                children.push(child)
            }
        }
    }
    return children
}

// The children that can hold a reference to a name: property names, binding
// patterns, parameters and type annotations only declare or label things.
const referenceChildren = node => {
    const { type } = node
    if (type === 'MemberExpression') {
        return node.computed ? [node.object, node.property] : [node.object]
    }
    if (type === 'Property') {
        return node.computed ? [node.key, node.value] : [node.value]
    }
    if (type === 'CallExpression') {
        return node.callee.type === 'Identifier'
            ? node.arguments
            : [node.callee, ...node.arguments]
    }
    if (type === 'ObjectPattern') return []
    if (type === 'AssignmentPattern') return [node.right]
    if (type === 'VariableDeclarator') return node.init ? [node.init] : []
    if (FUNCTION_TYPES.includes(type)) return [node.body]
    if (type.startsWith('TS') && !TYPE_WRAPPERS.includes(type)) return []
    return childNodes(node)
}

const visit = (node, fn) => {
    fn(node)
    for (const child of referenceChildren(node)) visit(child, fn)
}

const namesIn = (node, names) =>
    visit(node, current => {
        if (current.type === 'Identifier' && current.name !== 'undefined') {
            names.add(current.name)
        }
    })

const enclosingFunction = node => {
    for (let current = node.parent; current; current = current.parent) {
        if (FUNCTION_TYPES.includes(current.type)) return current
    }
    return undefined
}

const gateOf = call => {
    const options = call.arguments[0]
    if (options?.type !== 'ObjectExpression') return undefined
    const property = options.properties.findLast(
        entry =>
            entry.type === 'Property' &&
            !entry.computed &&
            entry.key.name === 'enabled',
    )
    if (property === undefined) return undefined
    const { value } = property
    if (
        (value.type === 'Literal' && typeof value.value === 'boolean') ||
        FUNCTION_TYPES.includes(value.type)
    ) {
        return undefined
    }
    const names = new Set()
    namesIn(value, names)
    if (names.size === 0) return undefined
    return { names: [...names], conjuncts: conjuncts(fact(value)) }
}

const sameNode = (a, b) => {
    if (a === b) return true
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
        return false
    }
    if (a.type === 'Identifier' && b.type === 'Identifier') {
        return a.name === b.name
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return (
            Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((entry, index) => sameNode(entry, b[index]))
        )
    }
    const keys = Object.keys(a).filter(key => !POSITION_KEYS.includes(key))
    const otherKeys = Object.keys(b).filter(key => !POSITION_KEYS.includes(key))
    return (
        keys.length === otherKeys.length &&
        keys.every(key => sameNode(a[key], b[key]))
    )
}

const isBooleanCast = node =>
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'Boolean' &&
    node.arguments.length === 1

// A condition known to hold, as its expression with any `!`, `!!` and
// Boolean() peeled off and folded into `negated`, so `!!address`,
// `Boolean(address)` and the fall-through of `if (!address) return` all
// compare equal.
const fact = (node, negated = false) => {
    let current = node
    let isNegated = negated
    for (;;) {
        if (TYPE_WRAPPERS.includes(current.type)) {
            current = current.expression
        } else if (
            current.type === 'UnaryExpression' &&
            current.operator === '!'
        ) {
            isNegated = !isNegated
            current = current.argument
        } else if (isBooleanCast(current)) {
            current = current.arguments[0]
        } else {
            return { node: current, negated: isNegated }
        }
    }
}

const negation = ({ node, negated }) => ({ node, negated: !negated })

// Splits `a && b` (or, negated, `a || b` by De Morgan) into the facts that
// each have to hold.
const conjuncts = ({ node, negated }) => {
    const operator = negated ? '||' : '&&'
    if (node.type === 'LogicalExpression' && node.operator === operator) {
        return [
            ...conjuncts(fact(node.left, negated)),
            ...conjuncts(fact(node.right, negated)),
        ]
    }
    return [{ node, negated }]
}

const sameFact = (a, b) => a.negated === b.negated && sameNode(a.node, b.node)

const flagName = node => {
    if (node.type === 'Identifier') return node.name
    if (node.type === 'MemberExpression' && !node.computed) {
        return node.property.name
    }
    return undefined
}

// isPaused is deliberately not a fix: a disabled query is not paused, so
// `!isPaused && query.isPending` still spins forever. Only facts that are
// false while disabled count; `fetchStatus === 'idle'` is true then.
const isFetchingFact = ({ node, negated }) => {
    if (flagName(node) === 'isFetching') return !negated
    if (node.type !== 'BinaryExpression') return false
    if (node.operator !== '===' && node.operator !== '!==') return false
    const sides = [node.left, node.right]
    const status = sides.find(side => flagName(side) === 'fetchStatus')
    const literal = sides.find(
        side => side.type === 'Literal' && typeof side.value === 'string',
    )
    if (status === undefined || literal === undefined) return false
    const isEquality = (node.operator === '===') !== negated
    return isEquality ? literal.value === 'fetching' : literal.value === 'idle'
}

const exits = statement =>
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement' ||
    (statement.type === 'BlockStatement' &&
        statement.body.length > 0 &&
        exits(statement.body.at(-1)))

const earlyExitFacts = (block, statement) => {
    const facts = []
    for (const earlier of block.body) {
        if (earlier === statement) break
        if (
            earlier.type === 'IfStatement' &&
            !earlier.alternate &&
            exits(earlier.consequent)
        ) {
            facts.push(...conjuncts(negation(fact(earlier.test))))
        }
    }
    return facts
}

const branchFacts = (parent, child) => {
    if (parent.consequent === child) return conjuncts(fact(parent.test))
    if (parent.alternate === child) {
        return conjuncts(negation(fact(parent.test)))
    }
    return []
}

// The facts that hold wherever the read's value reaches the hook's result.
// An `&&` operand counts only while the read's value flows straight into it;
// `||` adds nothing, because `!address || query.isPending` is true while
// disabled even though the read itself is only reached with an address.
const guardFacts = (read, fn) => {
    const facts = []
    let isValueChain = true
    let child = read
    for (
        let parent = read.parent;
        parent && parent !== fn;
        child = parent, parent = parent.parent
    ) {
        isValueChain = isValueChain && TRANSPARENT_TYPES.includes(parent.type)
        if (
            isValueChain &&
            parent.type === 'LogicalExpression' &&
            parent.operator === '&&'
        ) {
            const other = parent.left === child ? parent.right : parent.left
            facts.push(...conjuncts(fact(other)))
        } else if (
            parent.type === 'ConditionalExpression' ||
            parent.type === 'IfStatement'
        ) {
            facts.push(...branchFacts(parent, child))
        } else if (parent.type === 'BlockStatement') {
            facts.push(...earlyExitFacts(parent, child))
        }
    }
    return facts
}

const pendingLocals = pattern => {
    const locals = []
    for (const entry of pattern.properties) {
        if (
            entry.type !== 'Property' ||
            entry.computed ||
            entry.key.name !== 'isPending'
        ) {
            continue
        }
        const target =
            entry.value.type === 'AssignmentPattern'
                ? entry.value.left
                : entry.value
        if (target.type === 'Identifier') locals.push(target.name)
    }
    return locals
}

const calleeName = callee => {
    if (callee.type === 'Identifier') return callee.name
    if (callee.computed) return undefined
    return callee.property?.name
}

// A React deps list is read for identity, never rendered from.
const isDependencyEntry = read => {
    const list = read.parent
    if (list?.type !== 'ArrayExpression') return false
    const owner = list.parent
    if (owner?.type !== 'CallExpression') return false
    return (
        owner.arguments.indexOf(list) > 0 &&
        /^use[A-Z]/.test(calleeName(owner.callee) ?? '')
    )
}

const isGuarded = (read, fn, gate) => {
    const facts = guardFacts(read, fn)
    return (
        facts.some(isFetchingFact) ||
        gate.conjuncts.every(required =>
            facts.some(known => sameFact(known, required)),
        )
    )
}

export const queryPendingGated = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Read the isPending of a gated query together with its enabled condition',
        },
        messages: {
            ungated:
                '{{hook}} is gated by a non-literal enabled, and a disabled query stays isPending forever: make the read false whenever that condition (on {{gate}}) is false, by ANDing it with the condition itself (isEnabled && query.isPending), returning early when it fails, or ANDing it with isFetching.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                if (
                    node.callee.type !== 'Identifier' ||
                    !GATED_QUERY_HOOKS.includes(node.callee.name)
                ) {
                    return
                }
                const gate = gateOf(node)
                const declarator = node.parent
                if (
                    gate === undefined ||
                    declarator?.type !== 'VariableDeclarator' ||
                    declarator.init !== node
                ) {
                    return
                }
                const fn = enclosingFunction(node)
                if (fn === undefined) return

                const queryName =
                    declarator.id.type === 'Identifier'
                        ? declarator.id.name
                        : undefined
                const locals = new Set(
                    declarator.id.type === 'ObjectPattern'
                        ? pendingLocals(declarator.id)
                        : [],
                )
                const hook = node.callee.name

                const collectLocals = current => {
                    if (
                        current.type === 'VariableDeclarator' &&
                        queryName !== undefined &&
                        current.id.type === 'ObjectPattern' &&
                        current.init?.type === 'Identifier' &&
                        current.init.name === queryName
                    ) {
                        for (const name of pendingLocals(current.id)) {
                            locals.add(name)
                        }
                    }
                    childNodes(current).forEach(collectLocals)
                }
                collectLocals(fn.body)

                const reads = []
                visit(fn.body, current => {
                    const isMemberRead =
                        current.type === 'MemberExpression' &&
                        !current.computed &&
                        current.object.type === 'Identifier' &&
                        current.object.name === queryName &&
                        current.property.name === 'isPending'
                    const isLocalRead =
                        current.type === 'Identifier' &&
                        locals.has(current.name)
                    if (isMemberRead || isLocalRead) reads.push(current)
                })

                for (const read of reads) {
                    if (isDependencyEntry(read) || isGuarded(read, fn, gate)) {
                        continue
                    }
                    context.report({
                        node: read,
                        messageId: 'ungated',
                        data: { hook, gate: gate.names.join(', ') },
                    })
                }
            },
        }
    },
}
