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
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'
import {
    TransactionError,
    InvalidSendParamsError,
    AssetFrozenError,
    RekeyError,
} from '../errors'

describe('TransactionError', () => {
    it('is an instance of AppError and Error', () => {
        const error = new TransactionError('Something went wrong')

        expect(error).toBeInstanceOf(AppError)
        expect(error).toBeInstanceOf(Error)
    })

    it('sets severity to HIGH by default', () => {
        const error = new TransactionError('Something went wrong')

        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
    })

    it('sets category to TRANSACTIONS', () => {
        const error = new TransactionError('Something went wrong')

        expect(error.metadata.category).toBe(ErrorCategory.TRANSACTIONS)
    })

    it('sets retryable to false by default', () => {
        const error = new TransactionError('Something went wrong')

        expect(error.metadata.retryable).toBe(false)
    })

    it('stores the message string', () => {
        const error = new TransactionError('Transaction failed')

        expect(error.message).toBe('Transaction failed')
    })

    it('preserves the original error', () => {
        const originalError = new Error('network failure')
        const error = new TransactionError(
            'Something went wrong',
            originalError,
        )

        expect(error.originalError).toBe(originalError)
        expect(error.originalError?.message).toBe('network failure')
    })

    it('allows metadata overrides', () => {
        const error = new TransactionError('Something went wrong', undefined, {
            retryable: true,
        })

        expect(error.metadata.retryable).toBe(true)
        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
        expect(error.metadata.category).toBe(ErrorCategory.TRANSACTIONS)
    })

    it('should report because severity is HIGH', () => {
        const error = new TransactionError('Something went wrong')

        expect(error.shouldReport()).toBe(true)
    })

    it('sets the error name to the class name', () => {
        const error = new TransactionError('Something went wrong')

        expect(error.name).toBe('TransactionError')
    })
})

describe('InvalidSendParamsError', () => {
    it('is an instance of TransactionError and AppError', () => {
        const error = new InvalidSendParamsError()

        expect(error).toBeInstanceOf(TransactionError)
        expect(error).toBeInstanceOf(AppError)
    })

    it('uses a descriptive error message', () => {
        const error = new InvalidSendParamsError()

        expect(error.message).toBe('The transaction appears to be invalid')
    })

    it('stores error params in metadata', () => {
        const error = new InvalidSendParamsError(['amount', 'receiver'])

        expect(error.metadata.params).toEqual({
            errorParams: ['amount', 'receiver'],
        })
    })

    it('handles empty params array', () => {
        const error = new InvalidSendParamsError([])

        expect(error.metadata.params).toEqual({
            errorParams: [],
        })
    })

    it('handles undefined params', () => {
        const error = new InvalidSendParamsError()

        expect(error.metadata.params).toEqual({
            errorParams: undefined,
        })
    })

    it('preserves the original error', () => {
        const originalError = new Error('validation failed')
        const error = new InvalidSendParamsError(['amount'], originalError)

        expect(error.originalError).toBe(originalError)
    })

    it('sets the error name to InvalidSendParamsError', () => {
        const error = new InvalidSendParamsError()

        expect(error.name).toBe('InvalidSendParamsError')
    })

    it('inherits HIGH severity and TRANSACTIONS category', () => {
        const error = new InvalidSendParamsError()

        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
        expect(error.metadata.category).toBe(ErrorCategory.TRANSACTIONS)
        expect(error.metadata.retryable).toBe(false)
    })
})

describe('AssetFrozenError', () => {
    it('reuses the algod frozen copy and interpolates the asset', () => {
        const { titleKey, messageKey, params } = new AssetFrozenError('123')
            .metadata

        expect(titleKey).toBe('errors.algod.asset_frozen.title')
        expect(messageKey).toBe('errors.algod.asset_frozen.body')
        expect(params).toEqual({ assetId: '123' })
    })
})

describe('RekeyError', () => {
    it('tags the failed stage as the reason', () => {
        const error = new RekeyError('submission_failed')

        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('RekeyError')
        expect(error.reason).toBe('submission_failed')
    })

    it('preserves the original cause for downstream translation', () => {
        const cause = new Error('algod unreachable')
        const error = new RekeyError('submission_failed', cause)

        expect(error.originalError).toBe(cause)
    })

    it('leaves originalError undefined when no cause is given', () => {
        const error = new RekeyError('user_rejected')

        expect(error.originalError).toBeUndefined()
    })

    it('normalizes a non-Error cause to an Error', () => {
        // Caught values are not guaranteed to be Error instances.
        const error = new RekeyError('build_failed', 'something broke')

        expect(error.originalError).toBeInstanceOf(Error)
        expect(error.originalError?.message).toBe('something broke')
    })
})
