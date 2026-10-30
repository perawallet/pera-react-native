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

import { describe, expect, it, vi } from 'vitest'
import { componentLogicInHook } from '../rules/component-logic-in-hook.js'
import { call, id, member, type Node } from './helpers.js'

type Visitors = Partial<Record<string, (node: Node) => void>>

const lintIn = (filename: string, visitor: string, node: Node) => {
    const report = vi.fn()
    const visitors: Visitors = componentLogicInHook.create({ report, filename })
    visitors[visitor]?.(node)
    return report
}
const lint = (visitor: string, node: Node) =>
    lintIn('/repo/apps/mobile/src/Foo.tsx', visitor, node)

const hookCall = (name: string, args: Node[] = []): Node => call(id(name), args)
const reactHookCall = (name: string): Node =>
    call(member(id('React'), name), [])
const block = (...statements: Node[]): Node => ({
    type: 'BlockStatement',
    body: statements,
})
const arrow = (statements: Node[]): Node => ({
    type: 'ArrowFunctionExpression',
    params: [],
    body: block(...statements),
})
const declarator = (name: string, init: Node): Node => ({
    type: 'VariableDeclarator',
    id: id(name),
    init,
})
const fnDecl = (name: string, statements: Node[]): Node => ({
    type: 'FunctionDeclaration',
    id: id(name),
    params: [],
    body: block(...statements),
})

const state = () => hookCall('useState')
const effect = () => hookCall('useEffect')
const memo = () => hookCall('useMemo')

describe('pera/component-logic-in-hook', () => {
    it('reports a component that calls three React hooks in its body', () => {
        const node = declarator('Foo', arrow([state(), effect(), memo()]))

        expect(lint('VariableDeclarator', node)).toHaveBeenCalledOnce()
    })

    it('reports a function declaration component', () => {
        const node = fnDecl('Foo', [state(), effect(), memo()])

        expect(lint('FunctionDeclaration', node)).toHaveBeenCalledOnce()
    })

    it('reports a memo-wrapped component', () => {
        const node = declarator(
            'Foo',
            call(id('memo'), [arrow([state(), effect(), memo()])]),
        )

        expect(lint('VariableDeclarator', node)).toHaveBeenCalledOnce()
    })

    it('reports a forwardRef-wrapped component', () => {
        const node = declarator(
            'Foo',
            call(id('forwardRef'), [arrow([state(), effect(), memo()])]),
        )

        expect(lint('VariableDeclarator', node)).toHaveBeenCalledOnce()
    })

    it('counts a React.useState call the same as a useState call', () => {
        const node = declarator(
            'Foo',
            arrow([reactHookCall('useState'), effect(), memo()]),
        )

        expect(lint('VariableDeclarator', node)).toHaveBeenCalledOnce()
    })

    it('reports the component name and how many hooks it calls', () => {
        const node = declarator('Foo', arrow([state(), effect(), memo()]))
        const report = lint('VariableDeclarator', node)

        expect(report).toHaveBeenCalledWith({
            node: node.id,
            messageId: 'hooksInBody',
            data: { component: 'Foo', count: 3 },
        })
    })

    it('counts every React hook above the threshold', () => {
        const node = declarator(
            'Foo',
            arrow([
                state(),
                effect(),
                memo(),
                hookCall('useCallback'),
                hookCall('useRef'),
                hookCall('useReducer'),
                hookCall('useLayoutEffect'),
            ]),
        )
        const report = lint('VariableDeclarator', node)

        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({ data: { component: 'Foo', count: 7 } }),
        )
    })

    it.each([
        ['a component with two React hooks', 'Foo', arrow([state(), effect()])],
        [
            'a component whose own hook sits beside two React hooks',
            'SwapScreen',
            arrow([hookCall('useSwapScreen'), state(), effect()]),
        ],
        [
            'a component whose styles, theme and translation hooks fill the body',
            'Foo',
            arrow([
                hookCall('useStyles'),
                hookCall('useTheme'),
                hookCall('useLanguage'),
                hookCall('useTranslation'),
            ]),
        ],
        [
            'a component that only calls domain hooks',
            'Foo',
            arrow([
                hookCall('useAccountsStore'),
                hookCall('useNavigation'),
                hookCall('useAccountBalancesQuery'),
            ]),
        ],
        [
            'a component whose React hooks sit inside a callback',
            'Foo',
            arrow([
                hookCall('useEffect', [arrow([state(), memo()])]),
                hookCall('useEffect', [arrow([state()])]),
            ]),
        ],
        [
            'a component whose React hooks sit inside a nested handler',
            'Foo',
            arrow([
                hookCall('useCallback', [arrow([state()])]),
                hookCall('useCallback', [arrow([memo()])]),
            ]),
        ],
    ])('allows %s', (_label, name, init) => {
        expect(
            lint('VariableDeclarator', declarator(name, init)),
        ).not.toHaveBeenCalled()
    })

    it('allows a camelCase function', () => {
        const node = declarator('useFoo', arrow([state(), effect(), memo()]))

        expect(lint('VariableDeclarator', node)).not.toHaveBeenCalled()
    })

    it('allows a PascalCase declarator that is not a function', () => {
        const node = declarator('Foo', call(id('createFoo'), []))

        expect(lint('VariableDeclarator', node)).not.toHaveBeenCalled()
    })

    it('allows a component whose hooks sit in a hook of its own', () => {
        const node = declarator(
            'Foo',
            arrow([
                hookCall('useEffect', [
                    arrow([
                        hookCall('useState'),
                        hookCall('useMemo'),
                        hookCall('useCallback'),
                    ]),
                ]),
            ]),
        )

        expect(lint('VariableDeclarator', node)).not.toHaveBeenCalled()
    })

    it('skips a .ts file, where a flagged shape reports nothing', () => {
        const filename = '/repo/apps/mobile/src/hooks/useFoo.ts'
        const visitors: Visitors = componentLogicInHook.create({
            report: vi.fn(),
            filename,
        })

        expect(visitors.FunctionDeclaration).toBeUndefined()
        expect(visitors.VariableDeclarator).toBeUndefined()
        expect(
            lintIn(
                filename,
                'VariableDeclarator',
                declarator('Foo', arrow([state(), effect(), memo()])),
            ),
        ).not.toHaveBeenCalled()
    })
})
