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

// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { isLargeScreen } from '../screen'

describe('isLargeScreen', () => {
    it('is true for a tablet in either orientation', () => {
        expect(isLargeScreen(834, 1194)).toBe(true)
        expect(isLargeScreen(1194, 834)).toBe(true)
    })

    it('is false for a phone even when landscape makes it wide', () => {
        expect(isLargeScreen(844, 390)).toBe(false)
    })

    it('treats the 600dp boundary itself as large', () => {
        expect(isLargeScreen(600, 1000)).toBe(true)
        expect(isLargeScreen(599, 1000)).toBe(false)
    })
})
