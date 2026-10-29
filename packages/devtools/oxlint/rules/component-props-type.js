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

/** Callees whose first argument is the component function. */
export const COMPONENT_WRAPPERS = ['memo', 'forwardRef']

const isPascalCase = name => /^[A-Z][A-Za-z0-9]*$/.test(name)

const calleeName = callee =>
    callee.type === 'Identifier'
        ? callee.name
        : callee.type === 'MemberExpression' && !callee.computed
          ? callee.property?.name
          : undefined

// memo(forwardRef((props, ref) => …)) still resolves to the inner function.
const componentFunction = init => {
    if (
        init?.type === 'ArrowFunctionExpression' ||
        init?.type === 'FunctionExpression'
    ) {
        return init
    }
    if (
        init?.type === 'CallExpression' &&
        COMPONENT_WRAPPERS.includes(calleeName(init.callee))
    ) {
        return componentFunction(init.arguments[0])
    }
    return undefined
}

const propsAnnotation = param =>
    param?.type === 'AssignmentPattern'
        ? param.left.typeAnnotation
        : param?.typeAnnotation

// A literal anywhere in the annotation counts: Pick<X> & { … } and
// PropsWithChildren<{ … }> would otherwise sidestep the rule.
const containsTypeLiteral = root => {
    const visit = value => {
        if (Array.isArray(value)) return value.some(visit)
        if (value === null || typeof value !== 'object') return false
        if (value.type === 'TSTypeLiteral') return true
        return Object.keys(value).some(
            key =>
                key !== 'parent' &&
                key !== 'loc' &&
                key !== 'range' &&
                visit(value[key]),
        )
    }
    return visit(root)
}

export const componentPropsType = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Function components type their props with a named <Name>Props type declared above them, not an inline type literal',
        },
        messages: {
            inline: '{{component}} types its props with an inline type literal: declare type {{component}}Props above the component and annotate the props parameter with it.',
        },
        schema: [],
    },
    create(context) {
        if (!context.filename.endsWith('.tsx')) return {}

        const check = (component, fn) => {
            if (!isPascalCase(component)) return
            const annotation = propsAnnotation(fn?.params[0])
            if (annotation && containsTypeLiteral(annotation)) {
                context.report({
                    node: annotation,
                    messageId: 'inline',
                    data: { component },
                })
            }
        }
        return {
            FunctionDeclaration(node) {
                if (node.id) check(node.id.name, node)
            },
            VariableDeclarator(node) {
                if (node.id.type !== 'Identifier') return
                check(node.id.name, componentFunction(node.init))
            },
        }
    },
}
