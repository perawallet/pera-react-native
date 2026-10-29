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

export const GATED_QUERY_HOOKS = ['useQuery', 'useInfiniteQuery']

// isLoading is deliberately not checked: v5 defines it as isPending &&
// isFetching, so it is already false while a query is disabled or paused.

/** Reading either one says whether a fetch is actually running. */
export const FETCH_STATE_FLAGS = ['fetchStatus', 'isFetching']

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
]
const TYPE_WRAPPERS = [
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
]
const SKIPPED_KEYS = ['parent', 'loc', 'range']

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

const mentionsFetchState = node =>
    (node.type === 'Identifier' && FETCH_STATE_FLAGS.includes(node.name)) ||
    childNodes(node).some(mentionsFetchState)

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
    return names.size > 0 ? [...names] : undefined
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

const calleeName = callee =>
    callee.type === 'Identifier'
        ? callee.name
        : !callee.computed
          ? callee.property?.name
          : undefined

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

// isPaused is deliberately not a fix: a disabled query is not paused, so
// `!isPaused && query.isPending` still spins forever.
const isCombined = (read, gate) => {
    const names = new Set()
    let child = read
    for (
        let parent = read.parent;
        parent && TRANSPARENT_TYPES.includes(parent.type);
        parent = parent.parent
    ) {
        for (const sibling of childNodes(parent)) {
            if (sibling === child) continue
            if (mentionsFetchState(sibling)) return true
            namesIn(sibling, names)
        }
        child = parent
    }
    return gate.every(name => names.has(name))
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
                '{{hook}} is gated by a non-literal enabled, and a disabled query stays isPending forever: combine this read with every name in that condition ({{gate}}), e.g. isEnabled ? query.isPending : false, or with fetchStatus / isFetching.',
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
                    if (isDependencyEntry(read) || isCombined(read, gate)) {
                        continue
                    }
                    context.report({
                        node: read,
                        messageId: 'ungated',
                        data: { hook, gate: gate.join(', ') },
                    })
                }
            },
        }
    },
}
