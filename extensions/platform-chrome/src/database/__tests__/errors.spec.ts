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
import { isSqlStatementTimeout, SqlStatementTimeoutError } from '../errors'

describe('isSqlStatementTimeout', () => {
    it('recognises the timeout itself', () => {
        expect(
            isSqlStatementTimeout(new SqlStatementTimeoutError(30_000)),
        ).toBe(true)
    })

    it('recognises a timeout wrapped as the cause of a query error', () => {
        const wrapped = new Error('Failed query: UPDATE t', {
            cause: new SqlStatementTimeoutError(30_000),
        })

        expect(isSqlStatementTimeout(wrapped)).toBe(true)
    })

    it('rejects any other failure', () => {
        expect(isSqlStatementTimeout(new Error('syntax error'))).toBe(false)
        expect(isSqlStatementTimeout('timed out')).toBe(false)
    })
})
