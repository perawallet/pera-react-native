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
import { noNativeModalPresentation } from '../rules/no-native-modal-presentation.js'
import { id, type Node } from './helpers.js'

const literal = (value: string): Node => ({ type: 'Literal', value })

const lintPresentation = (
    value: Node,
    key = id('presentation'),
    computed = false,
) => {
    const report = vi.fn()
    noNativeModalPresentation.create({ report }).Property({
        type: 'Property',
        key,
        value,
        computed,
    })
    return report
}

describe('pera/no-native-modal-presentation', () => {
    it.each([
        'modal',
        'fullScreenModal',
        'transparentModal',
        'containedModal',
        'containedTransparentModal',
        'formSheet',
        'pageSheet',
    ])('reports the %s presentation', presentation => {
        const value = literal(presentation)

        expect(lintPresentation(value)).toHaveBeenCalledExactlyOnceWith({
            node: value,
            messageId: 'modal',
        })
    })

    it('checks literal property names and type assertions', () => {
        const value = {
            type: 'TSAsExpression',
            expression: literal('modal'),
        }

        expect(
            lintPresentation(value, literal('presentation'), true),
        ).toHaveBeenCalledOnce()
    })

    it('checks alternate branches of an options expression', () => {
        const value = {
            type: 'ConditionalExpression',
            test: id('isExpanded'),
            consequent: literal('card'),
            alternate: {
                type: 'LogicalExpression',
                operator: '??',
                left: id('defaultPresentation'),
                right: literal('transparentModal'),
            },
        }

        expect(lintPresentation(value)).toHaveBeenCalledOnce()
    })

    it('allows in-stack presentation and unrelated properties', () => {
        expect(lintPresentation(literal('card'))).not.toHaveBeenCalled()
        expect(
            lintPresentation(literal('modal'), id('size')),
        ).not.toHaveBeenCalled()
        expect(
            lintPresentation(literal('modal'), id('presentation'), true),
        ).not.toHaveBeenCalled()
    })
})
