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
import { httpsUrlSchema } from '../schemas'

describe('httpsUrlSchema', () => {
    it('accepts an https url and returns it unchanged', () => {
        expect(httpsUrlSchema.parse('https://host/path?token=abc')).toBe(
            'https://host/path?token=abc',
        )
    })

    it.each([
        'http://host/path',
        'javascript:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'perawallet://app/import',
        'content://com.evil.provider/secret',
        '//host/path',
        'not a url',
        '',
    ])('rejects %s', value => {
        expect(httpsUrlSchema.safeParse(value).success).toBe(false)
    })

    it('rejects a non-string, which would otherwise coerce into a valid host', () => {
        expect(httpsUrlSchema.safeParse(1234).success).toBe(false)
    })
})
