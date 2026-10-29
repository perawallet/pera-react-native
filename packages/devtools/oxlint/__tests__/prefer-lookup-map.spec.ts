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
import { preferLookupMap } from '../rules/prefer-lookup-map.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

const RULE = 'pera/prefer-lookup-map'

const lit = (value: unknown): Node => ({ type: 'Literal', value })
const switchOn = (discriminant: Node, cases: Node[]): Node => ({
    type: 'SwitchStatement',
    discriminant,
    cases,
})
const caseOf = (test: Node | null, consequent: Node[]): Node => ({
    type: 'SwitchCase',
    test,
    consequent,
})
const ret = (argument?: Node): Node => ({
    type: 'ReturnStatement',
    argument: argument ?? null,
})
const block = (...body: Node[]): Node => ({ type: 'BlockStatement', body })
const template = (): Node => ({
    type: 'TemplateLiteral',
    quasis: [],
    expressions: [],
})
const optional = (expression: Node): Node => ({
    type: 'ChainExpression',
    expression,
})
const computedMember = (object: Node, property: Node): Node => ({
    type: 'MemberExpression',
    computed: true,
    object,
    property,
})
const brk = (): Node => ({ type: 'BreakStatement', label: null })
const binary = (operator: string, left: Node, right: Node): Node => ({
    type: 'BinaryExpression',
    operator,
    left,
    right,
})

const braced = (test: Node | null, value: Node): Node =>
    caseOf(test, [block(ret(value))])
const bare = (test: Node | null, value: Node): Node =>
    caseOf(test, [ret(value)])
const kind = (name: string): Node => member(id('Kind'), name)

const lint = (node: Node) => {
    const report = vi.fn()
    preferLookupMap.create({ report }).SwitchStatement(node)
    return report
}

describe(RULE, () => {
    it.each([
        [
            'three braced string-literal returns',
            switchOn(id('key'), [
                braced(lit('a'), lit('A')),
                braced(lit('b'), lit('B')),
                braced(lit('c'), lit('C')),
            ]),
        ],
        [
            'unbraced returns',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), lit('C')),
            ]),
        ],
        [
            'null, number and boolean literals',
            switchOn(id('key'), [
                bare(lit(1), lit(null)),
                bare(lit(2), lit(7)),
                bare(lit(3), lit(true)),
            ]),
        ],
        [
            'member values with member tests',
            switchOn(id('key'), [
                bare(kind('A'), member(id('Colors'), 'primary')),
                bare(kind('B'), member(id('Colors'), 'secondary')),
                bare(kind('C'), member(id('Colors'), 'tertiary')),
            ]),
        ],
        [
            "t('a.b') values",
            switchOn(id('key'), [
                braced(lit('a'), call(id('t'), [lit('x.a')])),
                braced(lit('b'), call(id('t'), [lit('x.b')])),
                braced(lit('c'), call(id('t'), [lit('x.c')])),
            ]),
        ],
        [
            'two cases plus a constant default',
            switchOn(id('key'), [
                braced(lit('a'), lit('A')),
                braced(lit('b'), lit('B')),
                braced(null, lit('C')),
            ]),
        ],
        [
            'grouped empty labels plus two more cases',
            switchOn(id('key'), [
                caseOf(lit('a'), []),
                bare(lit('b'), lit('AB')),
                bare(lit('c'), lit('C')),
                bare(lit('d'), lit('D')),
            ]),
        ],
        [
            'a null case with no default',
            switchOn(id('key'), [
                bare(lit('a'), lit(null)),
                bare(lit('b'), lit('B')),
                bare(lit('c'), lit('C')),
            ]),
        ],
        [
            'a null default beside non-null cases',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(null, lit(null)),
            ]),
        ],
        [
            'a null value shared by a key and the default',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                caseOf(lit('c'), []),
                bare(null, lit(null)),
            ]),
        ],
        [
            'optional-chain member values',
            switchOn(id('key'), [
                bare(lit('a'), optional(member(id('Colors'), 'primary'))),
                bare(lit('b'), optional(member(id('Colors'), 'secondary'))),
                bare(lit('c'), optional(member(id('Colors'), 'tertiary'))),
            ]),
        ],
    ])('reports %s', (_label, node) => {
        expect(lint(node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'lookup',
        })
    })

    it.each([
        [
            'only two non-empty cases, however many labels',
            switchOn(id('key'), [
                caseOf(lit('a'), []),
                caseOf(lit('b'), []),
                bare(lit('c'), lit('C')),
                bare(lit('d'), lit('D')),
            ]),
        ],
        [
            'a template-literal value',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), template()),
            ]),
        ],
        [
            "t('a', { n })",
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), call(id('t'), [lit('x'), id('opts')])),
            ]),
        ],
        [
            't(key)',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), call(id('t'), [id('k')])),
            ]),
        ],
        [
            "format('x')",
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), call(id('format'), [lit('x')])),
            ]),
        ],
        [
            'a bare identifier value',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), id('fallback')),
            ]),
        ],
        [
            'a case with two statements',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                caseOf(lit('c'), [
                    { type: 'ExpressionStatement', expression: id('x') },
                    ret(lit('C')),
                ]),
            ]),
        ],
        [
            'a case ending in break',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                caseOf(lit('c'), [brk()]),
            ]),
        ],
        [
            'a member read off the discriminant root',
            switchOn(member(id('call'), 'kind'), [
                bare(lit('transfer'), member(id('call'), 'to')),
                bare(lit('approve'), member(id('call'), 'spender')),
                bare(lit('setApprovalForAll'), member(id('call'), 'operator')),
            ]),
        ],
        [
            'a member read off a bare-identifier discriminant',
            switchOn(id('call'), [
                bare(lit('a'), member(id('call'), 'to')),
                bare(lit('b'), member(id('call'), 'spender')),
                bare(lit('c'), member(id('call'), 'operator')),
            ]),
        ],
        [
            'switch (true) with expression tests',
            switchOn(lit(true), [
                bare(binary('>', id('n'), lit(1)), lit('A')),
                bare(binary('>', id('n'), lit(2)), lit('B')),
                bare(binary('>', id('n'), lit(3)), lit('C')),
            ]),
        ],
        [
            'a return with no argument',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                caseOf(lit('c'), [ret()]),
            ]),
        ],
        [
            'an optional-chain read off the discriminant root',
            switchOn(optional(member(id('call'), 'kind')), [
                bare(lit('a'), optional(member(id('call'), 'to'))),
                bare(lit('b'), optional(member(id('call'), 'spender'))),
                bare(lit('c'), optional(member(id('call'), 'operator'))),
            ]),
        ],
        [
            'a computed member value',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), computedMember(id('labels'), id('k'))),
            ]),
        ],
        [
            'a type-assertion value',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                bare(lit('b'), lit('B')),
                bare(lit('c'), {
                    type: 'TSAsExpression',
                    expression: lit('C'),
                }),
            ]),
        ],
        [
            'a null case beside a default',
            switchOn(id('key'), [
                bare(lit('a'), lit(null)),
                bare(lit('b'), lit('B')),
                bare(null, lit('X')),
            ]),
        ],
        [
            'a null case beside a default that is grouped with another key',
            switchOn(id('key'), [
                bare(lit('a'), lit('A')),
                braced(lit('b'), lit(null)),
                caseOf(lit('c'), []),
                bare(null, lit('X')),
            ]),
        ],
        [
            'an undefined case beside a default',
            switchOn(id('key'), [
                bare(lit('a'), id('undefined')),
                bare(lit('b'), lit('B')),
                bare(null, lit('X')),
            ]),
        ],
        [
            'regex literal values',
            switchOn(id('key'), [
                bare(lit('a'), { ...lit(null), regex: { pattern: 'a' } }),
                bare(lit('b'), { ...lit(null), regex: { pattern: 'b' } }),
                bare(lit('c'), { ...lit(null), regex: { pattern: 'c' } }),
            ]),
        ],
    ])('allows %s', (_label, node) => {
        expect(lint(node)).not.toHaveBeenCalled()
    })

    it('ships at error in the top-level rules of both configs', () => {
        for (const path of ['.oxlintrc.json', 'apps/mobile/.oxlintrc.json']) {
            const config = readOxlintConfig(path)
            expect(config.rules?.[RULE]).toBe('error')
            expect(overridesWith(config, RULE)).toEqual([])
        }
    })
})
