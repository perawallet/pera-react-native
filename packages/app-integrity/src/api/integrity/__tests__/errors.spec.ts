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
import { readIntegrityErrorCode } from '../errors'

describe('readIntegrityErrorCode', () => {
    it('reads the code through a wrapped HTTP error', () => {
        const error = {
            originalError: {
                data: { error: 'x', code: 'APP_INTEGRITY_REVOKED' },
            },
        }

        expect(readIntegrityErrorCode(error)).toBe('APP_INTEGRITY_REVOKED')
    })

    it('reads the code from a bare HTTP error', () => {
        expect(
            readIntegrityErrorCode({ data: { code: 'PUBLIC_KEY_IN_USE' } }),
        ).toBe('PUBLIC_KEY_IN_USE')
    })

    it.each([
        ['no error', null],
        ['a text body', { data: 'Bad Gateway' }],
        ['a numeric code', { data: { code: 403 } }],
        ['a plain Error', new Error('offline')],
    ])('answers undefined for %s', (_label, error) => {
        expect(readIntegrityErrorCode(error)).toBeUndefined()
    })
})
