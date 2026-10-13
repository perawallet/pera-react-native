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
import { sanitizeDappIcons } from '../icons'

const ORIGIN = 'https://app.example'

describe('sanitizeDappIcons', () => {
    it('keeps https icons on the connection origin, in order, deduplicated', () => {
        expect(
            sanitizeDappIcons(
                [
                    'https://app.example/a.png',
                    'https://app.example/a.png',
                    'https://app.example/b.svg',
                ],
                ORIGIN,
            ),
        ).toEqual(['https://app.example/a.png', 'https://app.example/b.svg'])
    })
    it('drops cross-origin, http, data:, and non-string entries', () => {
        expect(
            sanitizeDappIcons(
                [
                    'https://cdn.other/a.png',
                    'http://app.example/a.png',
                    'data:image/png;base64,AA==',
                    42,
                    null,
                ],
                ORIGIN,
            ),
        ).toBeUndefined()
    })
    it('returns undefined for a non-array or empty input', () => {
        expect(sanitizeDappIcons(undefined, ORIGIN)).toBeUndefined()
        expect(
            sanitizeDappIcons('https://app.example/a.png', ORIGIN),
        ).toBeUndefined()
        expect(sanitizeDappIcons([], ORIGIN)).toBeUndefined()
    })
    it('caps the list at four entries', () => {
        const icons = [1, 2, 3, 4, 5].map(i => `https://app.example/${i}.png`)
        expect(sanitizeDappIcons(icons, ORIGIN)).toHaveLength(4)
    })
})
