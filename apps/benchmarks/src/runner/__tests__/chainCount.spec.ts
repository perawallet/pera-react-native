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
import { chainsForScale } from '../chainCount'

describe('chainsForScale', () => {
    it('is only Algorand on a build that enables nothing else', () => {
        expect(chainsForScale(5, ['algorand'])).toEqual(['algorand'])
    })

    it('stops at the scale count, Algorand first', () => {
        expect(chainsForScale(2, ['ethereum', 'algorand', 'base'])).toEqual([
            'algorand',
            'ethereum',
        ])
    })

    it('takes every enabled chain when the scale asks for more', () => {
        expect(chainsForScale(99, ['algorand', 'ethereum', 'base'])).toEqual([
            'algorand',
            'ethereum',
            'base',
        ])
    })

    it('never covers fewer than one chain', () => {
        expect(chainsForScale(0, ['algorand', 'ethereum'])).toEqual([
            'algorand',
        ])
    })
})
