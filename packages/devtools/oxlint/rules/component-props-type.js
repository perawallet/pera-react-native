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

// Callees whose first argument is the component function, mapped to the index
// of their props type argument: forwardRef<Ref, Props> puts the ref first.
const PROPS_TYPE_ARGUMENT = new Map([
    ['memo', 0],
    ['forwardRef', 1],
])
export const COMPONENT_WRAPPERS = [...PROPS_TYPE_ARGUMENT.keys()]

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

const wrapperPropsTypes = init => {
    if (init?.type !== 'CallExpression') return []
    const index = PROPS_TYPE_ARGUMENT.get(calleeName(init.callee))
    if (index === undefined) return []
    const props = init.typeArguments?.params[index]
    return [...(props ? [props] : []), ...wrapperPropsTypes(init.arguments[0])]
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
            inline: '{{component}} types its props with an inline type literal: declare type {{component}}Props above the component and use it in place of the literal.',
        },
        schema: [],
    },
    create(context) {
        if (!context.filename.endsWith('.tsx')) return {}

        // Reports the first offending annotation only, so a component typed
        // inline in two places still gets one error.
        const check = (component, annotations) => {
            if (!isPascalCase(component)) return
            const annotation = annotations.find(
                candidate => candidate && containsTypeLiteral(candidate),
            )
            if (annotation) {
                context.report({
                    node: annotation,
                    messageId: 'inline',
                    data: { component },
                })
            }
        }
        return {
            FunctionDeclaration(node) {
                if (node.id) {
                    check(node.id.name, [propsAnnotation(node.params[0])])
                }
            },
            VariableDeclarator(node) {
                if (node.id.type !== 'Identifier') return
                const fn = componentFunction(node.init)
                if (!fn) return
                // const X: FC<{ … }>, memo<{ … }>(…) and forwardRef<Ref, { … }>(…)
                // type the props outside the parameter.
                check(node.id.name, [
                    propsAnnotation(fn.params[0]),
                    node.id.typeAnnotation,
                    ...wrapperPropsTypes(node.init),
                ])
            },
        }
    },
}
