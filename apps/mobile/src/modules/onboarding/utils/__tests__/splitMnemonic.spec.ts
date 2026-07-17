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

import { describe, it, expect } from 'vitest'
import { splitMnemonic } from '../splitMnemonic'

describe('splitMnemonic', () => {
    it('splits a space-separated mnemonic', () => {
        expect(splitMnemonic('alpha beta gamma')).toEqual([
            'alpha',
            'beta',
            'gamma',
        ])
    })

    it('splits a comma-separated mnemonic', () => {
        expect(splitMnemonic('alpha,beta,gamma')).toEqual([
            'alpha',
            'beta',
            'gamma',
        ])
    })

    it('splits a comma+space-separated mnemonic', () => {
        expect(splitMnemonic('alpha, beta, gamma')).toEqual([
            'alpha',
            'beta',
            'gamma',
        ])
    })

    it('tolerates any mix of newlines, tabs, spaces, and commas', () => {
        expect(splitMnemonic('alpha,\n  beta\t,gamma\n')).toEqual([
            'alpha',
            'beta',
            'gamma',
        ])
    })

    it('trims leading and trailing whitespace and commas', () => {
        expect(splitMnemonic('  ,alpha beta,  ')).toEqual(['alpha', 'beta'])
    })

    it('returns an empty array for blank input', () => {
        expect(splitMnemonic('')).toEqual([])
        expect(splitMnemonic('   ,,, \n\t')).toEqual([])
    })

    it('returns a single-element array for a single word', () => {
        expect(splitMnemonic('alpha')).toEqual(['alpha'])
    })
})
