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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_DATA_SIGN_REQUESTS } from '@perawallet/wallet-core-signing'

describe('vitest.setup signing stand-in', () => {
    it('mirrors the real MAX_DATA_SIGN_REQUESTS', () => {
        // The real constants module cannot be imported here (it reaches the
        // KMS barrel), so the mirror is checked against the source text.
        const source = readFileSync(
            resolve(__dirname, '../../../signing/src/constants.ts'),
            'utf8',
        )
        const declared = /MAX_DATA_SIGN_REQUESTS = (\d+)/.exec(source)?.[1]

        expect(declared).toBeDefined()
        expect(MAX_DATA_SIGN_REQUESTS).toBe(Number(declared))
    })
})
