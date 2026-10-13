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
import { noUnvalidatedOpenUrl } from '../rules/no-unvalidated-open-url.js'
import { call, id, member, type Node } from './helpers.js'

const openUrl = (...args: Node[]) =>
    call(member(id('Linking'), 'openURL'), args)

const lint = (node: Node) => {
    const report = vi.fn()
    noUnvalidatedOpenUrl.create({ report }).CallExpression(node)
    return report
}

describe('pera/no-unvalidated-open-url', () => {
    it.each([
        ['a string literal', openUrl({ type: 'Literal', value: 'https://x' })],
        [
            'a template without expressions',
            openUrl({ type: 'TemplateLiteral', expressions: [] }),
        ],
        [
            'a config member',
            openUrl(member(member(id('config'), 'urls'), 'support')),
        ],
        [
            'another object’s openURL',
            call(member(id('Other'), 'openURL'), [id('url')]),
        ],
    ])('allows %s', (_label, node) => {
        expect(lint(node)).not.toHaveBeenCalled()
    })

    it.each([
        ['an identifier', openUrl(id('url'))],
        ['a non-config member', openUrl(member(id('peer'), 'url'))],
        [
            'a template with expressions',
            openUrl({ type: 'TemplateLiteral', expressions: [id('x')] }),
        ],
        ['no argument', openUrl()],
    ])('reports %s', (_label, node) => {
        expect(lint(node)).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'unvalidated' }),
        )
    })
})
