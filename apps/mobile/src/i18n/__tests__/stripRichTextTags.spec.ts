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
import { stripRichTextTags } from '../stripRichTextTags'

describe('stripRichTextTags', () => {
    it('keeps the text inside numbered component tags', () => {
        expect(
            stripRichTextTags(
                "By adding a wallet, you agree to Pera Wallet's <0>Terms and Conditions</0> and <1>Privacy Policy</1>",
            ),
        ).toBe(
            "By adding a wallet, you agree to Pera Wallet's Terms and Conditions and Privacy Policy",
        )
    })

    it('drops self-closing component tags', () => {
        expect(stripRichTextTags('Line one<0/>line two')).toBe(
            'Line oneline two',
        )
    })

    it('leaves text that only looks like markup alone', () => {
        expect(stripRichTextTags('Fee < 1 ALGO <b>')).toBe('Fee < 1 ALGO <b>')
    })
})
