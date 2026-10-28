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
import { testIdProp } from '../rules/test-id-prop.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

describe('pera/test-id-prop', () => {
    const spread = (argument: Node): Node => ({
        type: 'JSXSpreadAttribute',
        argument,
    })
    const lit = (value: string): Node => ({ type: 'Literal', value })

    const lintSpread = (node: Node) => {
        const report = vi.fn()
        const visitors = testIdProp.create({ report })
        visitors[node.type as keyof typeof visitors]?.(node)
        return report
    }

    it.each([
        ['getTestProps(id)', spread(call(id('getTestProps'), [lit('x')]))],
        [
            'getTestProps(id, suffix)',
            spread(call(id('getTestProps'), [id('testID'), lit('view')])),
        ],
        [
            'a member callee',
            spread(call(member(id('testIds'), 'getTestProps'), [lit('x')])),
        ],
    ])('reports a spread of %s', (_label, node) => {
        expect(lintSpread(node)).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'spread' }),
        )
    })

    it.each([
        [
            'getContainerTestProps',
            spread(call(id('getContainerTestProps'), [lit('x')])),
        ],
        [
            'getCheckboxTestProps',
            spread(call(id('getCheckboxTestProps'), [lit('x'), id('on')])),
        ],
        ['an identifier', spread(id('rest'))],
        [
            'a member that is not called',
            spread(member(id('props'), 'getTestProps')),
        ],
        [
            'an object-literal spread',
            {
                type: 'SpreadElement',
                argument: call(id('getTestProps'), [id('id')]),
            },
        ],
    ])('allows %s', (_label, node) => {
        expect(lintSpread(node)).not.toHaveBeenCalled()
    })

    it('blocks in mobile source outside components/core', () => {
        const overrides = overridesWith(
            readOxlintConfig('apps/mobile/.oxlintrc.json'),
            'pera/test-id-prop',
        )
        expect(
            overrides.map(o => [
                o.files,
                o.excludeFiles,
                o.rules['pera/test-id-prop'],
            ]),
        ).toEqual([[['src/**/*.{ts,tsx}'], ['src/components/core/**'], 'error']])
    })
})
