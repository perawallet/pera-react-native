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
    ErrorSeverity,
    isExpectedError,
    isRetryableError,
} from '@perawallet/wallet-core-shared'
import { ProgramSigningUnsupportedError } from '../useProgramSigner'
import { UserRejectedSigningError } from '../useSignAndSubmitGroup'

describe('UserRejectedSigningError', () => {
    it('is a low-severity, non-retryable AppError with no copy of its own', () => {
        const error = new UserRejectedSigningError()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe('UserRejectedSigningError')
        expect(error.message).toBe('User rejected signing')
        expect(error.metadata).toMatchObject({
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.TRANSACTIONS,
        })
        expect(error.metadata.messageKey).toBeUndefined()
        expect(isRetryableError(error)).toBe(false)
        expect(isExpectedError(error)).toBe(false)
    })
})

describe('ProgramSigningUnsupportedError', () => {
    // Not VALIDATION: the local-key strategy reads that category as a dApp
    // request fault and would drop its signing-failure copy.
    it('is a non-recoverable accounts AppError', () => {
        const error = new ProgramSigningUnsupportedError('ADDR')

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe('ProgramSigningUnsupportedError')
        expect(error.message).toBe('Cannot sign a program with ADDR')
        expect(error.metadata).toMatchObject({
            category: ErrorCategory.ACCOUNTS,
            recoverable: false,
            retryable: false,
        })
        expect(error.metadata.messageKey).toBeUndefined()
    })
})
