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
import {
    AppError,
    ErrorCategory,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import {
    SqlStatementTimeoutError,
    isSqlStatementTimeout,
} from '../database/errors'

const rows: [string, () => AppError, ErrorCategory][] = [
    [
        'SqlStatementTimeoutError',
        () => new SqlStatementTimeoutError(100),
        ErrorCategory.STORAGE,
    ],
]

describe('platform-chrome domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('is still found along a cause chain', () => {
        const wrapped = new Error('drizzle failed', {
            cause: new SqlStatementTimeoutError(100),
        })

        expect(isSqlStatementTimeout(wrapped)).toBe(true)
    })
})
