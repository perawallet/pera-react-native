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
} from '@perawallet/wallet-core-shared'
import {
    FeeDelegationAttestationRequiredError,
    FeeDelegationResponseMismatchError,
} from '..'

describe('FeeDelegationAttestationRequiredError', () => {
    it('is an AppError that leaves the wording to the caller', () => {
        const error = new FeeDelegationAttestationRequiredError()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe('FeeDelegationAttestationRequiredError')
        expect(error.message).toBe(
            'Device verification is required for fee-delegated transactions.',
        )
        expect(error.metadata).toMatchObject({
            category: ErrorCategory.UNKNOWN,
            recoverable: false,
            retryable: false,
        })
        expect(error.metadata.messageKey).toBeUndefined()
    })
})

describe('FeeDelegationResponseMismatchError', () => {
    it('is a high-severity, reportable transaction error', () => {
        const error = new FeeDelegationResponseMismatchError()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe('FeeDelegationResponseMismatchError')
        expect(error.metadata).toMatchObject({
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.TRANSACTIONS,
            recoverable: false,
            retryable: false,
        })
        expect(error.metadata.messageKey).toBeUndefined()
        expect(isExpectedError(error)).toBe(false)
    })
})
