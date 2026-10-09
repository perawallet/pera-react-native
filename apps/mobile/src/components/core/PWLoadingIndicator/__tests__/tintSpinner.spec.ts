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

import { describe, it, expect } from 'vitest'
import spinnerAnimation from '@assets/animations/loading-spinner.json'
import { tintSpinner } from '../tintSpinner'

const fillKeyframes = (animation: ReturnType<typeof tintSpinner>) =>
    animation.layers.flatMap(layer =>
        layer.shapes
            ? layer.shapes.flatMap(shape =>
                  shape.ty === 'fl' && shape.c ? shape.c.k.map(k => k.s) : [],
              )
            : [],
    )

describe('tintSpinner', () => {
    it('keeps the black design for black', () => {
        expect(fillKeyframes(tintSpinner('#000000'))).toEqual(
            fillKeyframes(spinnerAnimation),
        )
    })

    it('fades white toward black by the same amount, as the white design does', () => {
        const black = fillKeyframes(spinnerAnimation)
        const white = fillKeyframes(tintSpinner('#FFFFFF'))

        white.forEach((value, index) => {
            const fade = black[index][0]
            expect(value).toEqual([1 - fade, 1 - fade, 1 - fade, 1])
        })
    })

    it('returns the same source for the same colour', () => {
        expect(tintSpinner('#123456')).toBe(tintSpinner('#123456'))
    })
})
