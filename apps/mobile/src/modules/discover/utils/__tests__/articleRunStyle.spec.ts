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

import { describe, expect, it } from 'vitest'
import { articleRunStyle } from '../articleRunStyle'

const run = (marks: Partial<Record<'bold' | 'italic' | 'code', boolean>>) => ({
    type: 'text' as const,
    value: 'x',
    bold: false,
    italic: false,
    code: false,
    ...marks,
})

describe('articleRunStyle', () => {
    it('leaves an unmarked run plain so it inherits its block or link', () => {
        expect(articleRunStyle(run({}), 'h3', false)).toEqual({ plain: true })
        expect(articleRunStyle(run({}), 'body', true)).toEqual({ plain: true })
    })

    it('keeps the block variant for bold and italic, changing only weight or slant', () => {
        expect(articleRunStyle(run({ bold: true }), 'h3', false)).toEqual({
            plain: false,
            variant: 'h3',
            weight: 700,
            italic: false,
            link: false,
        })
        expect(articleRunStyle(run({ italic: true }), 'body', false)).toEqual({
            plain: false,
            variant: 'body',
            weight: undefined,
            italic: true,
            link: false,
        })
    })

    it('uses the mono variant for code', () => {
        expect(articleRunStyle(run({ code: true }), 'h2', false)).toMatchObject(
            {
                variant: 'mono',
            },
        )
    })

    it('keeps the link colour on a marked run inside a link', () => {
        expect(
            articleRunStyle(run({ bold: true }), 'body', true),
        ).toMatchObject({
            variant: 'body',
            weight: 700,
            link: true,
        })
    })
})
