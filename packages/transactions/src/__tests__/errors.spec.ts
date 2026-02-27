/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    ERROR_I18N_KEYS,
} from '@perawallet/wallet-core-shared'
import { TransactionError, InvalidSendParamsError } from '../errors'

describe('TransactionError', () => {
    it('is an instance of AppError and Error', () => {
        const error = new TransactionError(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC)

        expect(error).toBeInstanceOf(AppError)
        expect(error).toBeInstanceOf(Error)
    })

    it('sets severity to HIGH by default', () => {
        const error = new TransactionError(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC)

        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
    })

    it('sets category to TRANSACTIONS', () => {
        const error = new TransactionError(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC)

        expect(error.metadata.category).toBe(ErrorCategory.TRANSACTIONS)
    })

    it('sets retryable to false by default', () => {
        const error = new TransactionError(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC)

        expect(error.metadata.retryable).toBe(false)
    })

    it('stores the i18n key as the message', () => {
        const error = new TransactionError(
            ERROR_I18N_KEYS.BLOCKCHAIN_TRANSACTION,
        )

        expect(error.message).toBe(ERROR_I18N_KEYS.BLOCKCHAIN_TRANSACTION)
        expect(error.getI18nKey()).toBe(ERROR_I18N_KEYS.BLOCKCHAIN_TRANSACTION)
    })

    it('preserves the original error', () => {
        const originalError = new Error('network failure')
        const error = new TransactionError(
            ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC,
            originalError,
        )

        expect(error.originalError).toBe(originalError)
        expect(error.originalError?.message).toBe('network failure')
    })

    it('allows metadata overrides', () => {
        const error = new TransactionError(
            ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC,
            undefined,
            { retryable: true },
        )

        expect(error.metadata.retryable).toBe(true)
        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
        expect(error.metadata.category).toBe(ErrorCategory.TRANSACTIONS)
    })

    it('should report because severity is HIGH', () => {
        const error = new TransactionError(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC)

        expect(error.shouldReport()).toBe(true)
    })

    it('sets the error name to the class name', () => {
        const error = new TransactionError(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC)

        expect(error.name).toBe('TransactionError')
    })
})

describe('InvalidSendParamsError', () => {
    it('is an instance of TransactionError and AppError', () => {
        const error = new InvalidSendParamsError()

        expect(error).toBeInstanceOf(TransactionError)
        expect(error).toBeInstanceOf(AppError)
    })

    it('uses the TRANSACTIONS_INVALID_SEND_PARAMS i18n key', () => {
        const error = new InvalidSendParamsError()

        expect(error.message).toBe(
            ERROR_I18N_KEYS.TRANSACTIONS_INVALID_SEND_PARAMS,
        )
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
