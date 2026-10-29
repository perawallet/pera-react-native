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

import { describe, expect, it, vi } from 'vitest'
import {
    COMPONENT_WRAPPERS,
    componentPropsType,
} from '../rules/component-props-type.js'
import { call, id, member, type Node } from './helpers.js'

type Visitors = Partial<Record<string, (node: Node) => void>>

const lintIn = (filename: string, visitor: string, node: Node) => {
    const report = vi.fn()
    const visitors: Visitors = componentPropsType.create({ report, filename })
    visitors[visitor]?.(node)
    return report
}
const lint = (visitor: string, node: Node) =>
    lintIn('/repo/apps/mobile/src/Foo.tsx', visitor, node)

const typeLiteral = (): Node => ({ type: 'TSTypeLiteral', members: [] })
const typeRef = (name: string, ...params: Node[]): Node => ({
    type: 'TSTypeReference',
    typeName: id(name),
    typeArguments: params.length
        ? { type: 'TSTypeParameterInstantiation', params }
        : undefined,
})
const intersection = (...types: Node[]): Node => ({
    type: 'TSIntersectionType',
    types,
})
const annotation = (typeAnnotation: Node): Node => ({
    type: 'TSTypeAnnotation',
    typeAnnotation,
})
const annotated = (param: Node, type: Node): Node => ({
    ...param,
    typeAnnotation: annotation(type),
})
const objectPattern = (): Node => ({ type: 'ObjectPattern', properties: [] })
const arrow = (params: Node[]): Node => ({
    type: 'ArrowFunctionExpression',
    params,
})
const fnExpr = (params: Node[]): Node => ({
    type: 'FunctionExpression',
    params,
})
const declarator = (name: string, init: Node | null): Node => ({
    type: 'VariableDeclarator',
    id: id(name),
    init,
})
const fnDecl = (name: string, params: Node[]): Node => ({
    type: 'FunctionDeclaration',
    id: id(name),
    params,
})

const inline = () => annotated(objectPattern(), typeLiteral())
const named = () => annotated(objectPattern(), typeRef('FooProps'))

describe('pera/component-props-type', () => {
    it.each([
        [
            'an arrow component',
            'VariableDeclarator',
            declarator('Foo', arrow([inline()])),
        ],
        [
            'a function declaration',
            'FunctionDeclaration',
            fnDecl('Foo', [inline()]),
        ],
        [
            'a function expression',
            'VariableDeclarator',
            declarator('Foo', fnExpr([inline()])),
        ],
        [
            'an identifier props parameter',
            'VariableDeclarator',
            declarator('Foo', arrow([annotated(id('props'), typeLiteral())])),
        ],
        [
            'a defaulted props parameter',
            'VariableDeclarator',
            declarator(
                'Foo',
                arrow([
                    {
                        type: 'AssignmentPattern',
                        left: annotated(id('props'), typeLiteral()),
                        right: { type: 'ObjectExpression', properties: [] },
                    },
                ]),
            ),
        ],
        [
            'an intersection with a literal',
            'VariableDeclarator',
            declarator(
                'Foo',
                arrow([
                    annotated(
                        objectPattern(),
                        intersection(
                            typeRef('Pick', typeRef('X')),
                            typeLiteral(),
                        ),
                    ),
                ]),
            ),
        ],
        [
            'a literal as a type argument',
            'VariableDeclarator',
            declarator(
                'Foo',
                arrow([
                    annotated(
                        objectPattern(),
                        typeRef('PropsWithChildren', typeLiteral()),
                    ),
                ]),
            ),
        ],
        [
            'memo(forwardRef(arrow))',
            'VariableDeclarator',
            declarator(
                'Foo',
                call(id('memo'), [call(id('forwardRef'), [arrow([inline()])])]),
            ),
        ],
    ])('reports %s typed with an inline literal', (_label, visitor, node) => {
        expect(lint(visitor, node as Node)).toHaveBeenCalledOnce()
    })

    it.each(COMPONENT_WRAPPERS)('reports a bare %s(arrow) call', wrapper => {
        const node = declarator('Foo', call(id(wrapper), [arrow([inline()])]))

        expect(lint('VariableDeclarator', node)).toHaveBeenCalledOnce()
    })

    it.each(COMPONENT_WRAPPERS)('reports a React.%s(arrow) call', wrapper => {
        const node = declarator(
            'Foo',
            call(member(id('React'), wrapper), [arrow([inline()])]),
        )

        expect(lint('VariableDeclarator', node)).toHaveBeenCalledOnce()
    })

    it('reports on the props annotation, naming the component and the type to declare', () => {
        const props = inline()
        const report = lint(
            'VariableDeclarator',
            declarator('Foo', arrow([props])),
        )

        expect(report).toHaveBeenCalledWith({
            node: props.typeAnnotation,
            messageId: 'inline',
            data: { component: 'Foo' },
        })
    })

    it.each([
        [
            'a component typed FooProps',
            'VariableDeclarator',
            declarator('Foo', arrow([named()])),
        ],
        [
            'a Pick of a named type with no literal',
            'VariableDeclarator',
            declarator(
                'Foo',
                arrow([
                    annotated(
                        objectPattern(),
                        typeRef('Pick', typeRef('FooProps')),
                    ),
                ]),
            ),
        ],
        [
            'a camelCase function',
            'VariableDeclarator',
            declarator('renderItem', arrow([inline()])),
        ],
        [
            'a component with no params',
            'VariableDeclarator',
            declarator('Foo', arrow([])),
        ],
        [
            'an untyped param',
            'VariableDeclarator',
            declarator('Foo', arrow([objectPattern()])),
        ],
        [
            'a forwardRef whose ref param is a literal but whose props are named',
            'VariableDeclarator',
            declarator(
                'Foo',
                call(id('forwardRef'), [
                    arrow([named(), annotated(id('ref'), typeLiteral())]),
                ]),
            ),
        ],
        [
            'memo wrapping an identifier',
            'VariableDeclarator',
            declarator('Foo', call(id('memo'), [id('Inner')])),
        ],
        [
            'a PascalCase non-function',
            'VariableDeclarator',
            declarator('Stack', call(id('createStack'), [])),
        ],
        [
            'a declarator with no init',
            'VariableDeclarator',
            declarator('Foo', null),
        ],
        [
            'a destructured declarator id',
            'VariableDeclarator',
            {
                type: 'VariableDeclarator',
                id: objectPattern(),
                init: arrow([inline()]),
            },
        ],
        [
            'a SCREAMING_CASE name',
            'VariableDeclarator',
            declarator('FOO_BAR', arrow([inline()])),
        ],
        [
            'an anonymous function declaration',
            'FunctionDeclaration',
            { type: 'FunctionDeclaration', id: null, params: [inline()] },
        ],
        [
            'a function declaration with a camelCase name',
            'FunctionDeclaration',
            fnDecl('renderFoo', [inline()]),
        ],
    ])('allows %s', (_label, visitor, node) => {
        expect(lint(visitor, node as Node)).not.toHaveBeenCalled()
    })

    it('skips a .ts file, where a flagged shape reports nothing', () => {
        const filename = '/repo/apps/mobile/src/routes/createStack.ts'
        const visitors: Visitors = componentPropsType.create({
            report: vi.fn(),
            filename,
        })

        expect(visitors.FunctionDeclaration).toBeUndefined()
        expect(visitors.VariableDeclarator).toBeUndefined()
        expect(
            lintIn(
                filename,
                'VariableDeclarator',
                declarator('Navigator', arrow([inline()])),
            ),
        ).not.toHaveBeenCalled()
    })
})
