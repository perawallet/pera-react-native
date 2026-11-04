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
import { addressMatchSegments } from '../addressMatchSegments'

const ADDRESS = '0xC3D7aaaaaaaaaaaaaaaa9f9faaaaaaaaaaaaaaaa5300'
const TRUNCATED = '0xC3D7...5300'

describe('addressMatchSegments', () => {
    it('highlights a match inside the visible head', () => {
        expect(addressMatchSegments(ADDRESS, TRUNCATED, '0xc3')).toEqual([
            { text: '0xC3', isMatch: true },
            { text: 'D7...5300', isMatch: false },
        ])
    })

    it('highlights a match inside the visible tail', () => {
        expect(addressMatchSegments(ADDRESS, TRUNCATED, '5300')).toEqual([
            { text: '0xC3D7...', isMatch: false },
            { text: '5300', isMatch: true },
        ])
    })

    it('splices a match from the hidden middle between head and tail', () => {
        expect(addressMatchSegments(ADDRESS, TRUNCATED, '9f9f')).toEqual([
            { text: '0xC3D7...', isMatch: false },
            { text: '9f9f', isMatch: true },
            { text: '...5300', isMatch: false },
        ])
    })

    it('joins a match that runs from the head into the hidden middle', () => {
        expect(addressMatchSegments(ADDRESS, TRUNCATED, '0xc3d7aa')).toEqual([
            { text: '0xC3D7aa', isMatch: true },
            { text: '...5300', isMatch: false },
        ])
    })

    it('marks the short form, not the whole address, when the match covers the hidden middle', () => {
        expect(addressMatchSegments(ADDRESS, TRUNCATED, ADDRESS)).toEqual([
            { text: TRUNCATED, isMatch: true },
        ])
        expect(
            addressMatchSegments(ADDRESS, TRUNCATED, ADDRESS.slice(3, 44)),
        ).toEqual([
            { text: '0xC', isMatch: false },
            { text: '3D7...53', isMatch: true },
            { text: '00', isMatch: false },
        ])
    })

    it('shows the short form unmarked when nothing matches', () => {
        expect(addressMatchSegments(ADDRESS, TRUNCATED, 'zzz')).toEqual([
            { text: TRUNCATED, isMatch: false },
        ])
    })

    it('marks the match within an address short enough to show in full', () => {
        expect(addressMatchSegments('0xBEEF', '0xBEEF', 'ee')).toEqual([
            { text: '0xB', isMatch: false },
            { text: 'EE', isMatch: true },
            { text: 'F', isMatch: false },
        ])
    })
})
