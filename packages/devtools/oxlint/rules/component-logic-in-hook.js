/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

// React's state, effect, memoisation and ref hooks: the calls that hold a
// component's own logic. The styles (useStyles), theme, translation and
// domain hooks carry none, and the component's own use[Name] hook is the
// extraction this rule asks for, so none of them count towards the threshold.
export const COMPONENT_LOGIC_HOOKS = new Set([
    'useState',
    'useReducer',
    'useRef',
    'useEffect',
    'useLayoutEffect',
    'useMemo',
    'useCallback',
])

export const HOOK_THRESHOLD = 3

const FUNCTION_TYPES = new Set([
    'ArrowFunctionExpression',
    'FunctionExpression',
    'FunctionDeclaration',
])

const COMPONENT_WRAPPERS = ['memo', 'forwardRef']

const isPascalCase = name => /^[A-Z][A-Za-z0-9]*$/.test(name)

const calleeName = callee => {
    if (callee?.type === 'Identifier') return callee.name
    if (callee?.type === 'MemberExpression' && !callee.computed) {
        return callee.property?.name
    }
    return undefined
}

// memo(forwardRef((props, ref) => …)) still resolves to the inner function.
const componentFunction = init => {
    if (!init) return undefined
    if (
        init.type === 'ArrowFunctionExpression' ||
        init.type === 'FunctionExpression'
    ) {
        return init
    }
    if (init.type === 'CallExpression') {
        const name = calleeName(init.callee)
        if (name && COMPONENT_WRAPPERS.includes(name)) {
            return componentFunction(init.arguments[0])
        }
    }
    return undefined
}

// The hook calls the component body makes itself. A call inside a callback or
// an event handler belongs to that callback, not to the component.
const directHookCalls = component => {
    const names = []
    const visit = (node, depth) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) {
            node.forEach(child => visit(child, depth))
            return
        }
        if (typeof node.type !== 'string') return
        if (node.type === 'CallExpression' && depth === 0) {
            const name = calleeName(node.callee)
            if (name) names.push(name)
        }
        const childDepth = FUNCTION_TYPES.has(node.type) ? depth + 1 : depth
        for (const key of Object.keys(node)) {
            if (key === 'parent') continue
            visit(node[key], childDepth)
        }
    }
    visit(component.body, 0)
    return names
}

export const componentLogicInHook = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Component state and effects live in a colocated use[Component] hook, not in the component body',
        },
        messages: {
            hooksInBody:
                '{{component}} calls {{count}} React hooks in its body: move them into a colocated use{{component}} hook.',
        },
        schema: [],
    },
    create(context) {
        if (!context.filename.endsWith('.tsx')) return {}

        const check = (name, component) => {
            if (!name || !isPascalCase(name) || !component) return
            const count = directHookCalls(component).filter(hook =>
                COMPONENT_LOGIC_HOOKS.has(hook),
            ).length
            if (count < HOOK_THRESHOLD) return
            context.report({
                node: component.id,
                messageId: 'hooksInBody',
                data: { component: name, count },
            })
        }

        return {
            FunctionDeclaration(node) {
                check(node.id?.name, node)
            },
            VariableDeclarator(node) {
                if (node.id?.type !== 'Identifier') return
                check(node.id.name, {
                    id: node.id,
                    body: componentFunction(node.init)?.body,
                })
            },
        }
    },
}
