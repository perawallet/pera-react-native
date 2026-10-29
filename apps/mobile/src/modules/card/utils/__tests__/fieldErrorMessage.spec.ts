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
import { fieldErrorMessageOf } from '../fieldErrorMessage'

describe('fieldErrorMessageOf', () => {
    it('returns the message of a server error', () => {
        const error = { type: 'server', message: 'Email already in use' }

        expect(fieldErrorMessageOf(error, '', 'Invalid')).toBe(
            'Email already in use',
        )
    })

    it('returns undefined for a server error without a message', () => {
        expect(
            fieldErrorMessageOf({ type: 'server' }, 'a@b.c', 'Invalid'),
        ).toBeUndefined()
    })

    it('returns the invalid message for a client error on a filled field', () => {
        expect(
            fieldErrorMessageOf({ type: 'pattern' }, 'nope', 'Invalid'),
        ).toBe('Invalid')
    })

    it('stays silent for a client error on an empty field', () => {
        expect(
            fieldErrorMessageOf({ type: 'required' }, '', 'Invalid'),
        ).toBeUndefined()
    })

    it('returns undefined without an error', () => {
        expect(
            fieldErrorMessageOf(undefined, 'a@b.c', 'Invalid'),
        ).toBeUndefined()
    })
})
