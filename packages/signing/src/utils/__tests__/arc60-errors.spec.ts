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
} from '@perawallet/wallet-core-shared'
import {
    Arc60InvalidScopeError,
    Arc60FailedDecodingError,
    Arc60InvalidSignerError,
    Arc60MissingDomainError,
    Arc60MissingAuthDataError,
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60BadRequestError,
    Arc60FailedHdPathError,
} from '../arc60-errors'

describe('Arc60InvalidScopeError', () => {
    it('formats the message with the offending scope and carries validation metadata', () => {
        const error = new Arc60InvalidScopeError(7)

        expect(error).toBeInstanceOf(AppError)
        expect(error.message).toBe('ARC-60 scope 7 is not supported')
        expect(error.name).toBe('Arc60InvalidScopeError')
        expect(error.metadata.severity).toBe(ErrorSeverity.MEDIUM)
        expect(error.metadata.category).toBe(ErrorCategory.VALIDATION)
        expect(error.metadata.recoverable).toBe(false)
        expect(error.metadata.params).toEqual({ scope: 7 })
    })
})

describe('Arc60FailedDecodingError', () => {
    it('records encoding in message + params and preserves the original error', () => {
        const cause = new Error('bad base64')
        const error = new Arc60FailedDecodingError('base64', cause)

        expect(error.message).toBe(
            'Failed to decode ARC-60 data using encoding "base64"',
        )
        expect(error.metadata.params).toEqual({ encoding: 'base64' })
        expect(error.originalError).toBe(cause)
    })
})

describe('Arc60InvalidSignerError', () => {
    it('omits the reason clause when no reason is given', () => {
        const error = new Arc60InvalidSignerError('ADDR')

        expect(error.message).toBe(
            'ARC-60 signer ADDR is not available in this wallet',
        )
        expect(error.metadata.params).toEqual({
            signer: 'ADDR',
            reason: undefined,
        })
    })

    it('appends the reason clause when a reason is given', () => {
        const error = new Arc60InvalidSignerError('ADDR', 'rekeyed away')

        expect(error.message).toBe(
            'ARC-60 signer ADDR is invalid: rekeyed away',
        )
        expect(error.metadata.params).toEqual({
            signer: 'ADDR',
            reason: 'rekeyed away',
        })
    })
})

describe('Arc60MissingDomainError', () => {
    it('reports the missing domain field', () => {
        const error = new Arc60MissingDomainError()

        expect(error.message).toBe(
            'ARC-60 request is missing required `domain` field',
        )
        expect(error.metadata.category).toBe(ErrorCategory.VALIDATION)
    })
})

describe('Arc60MissingAuthDataError', () => {
    it('reports the missing authenticatorData field', () => {
        const error = new Arc60MissingAuthDataError()

        expect(error.message).toBe(
            'ARC-60 request is missing required `authenticatorData` field',
        )
    })
})

describe('Arc60BadJsonError', () => {
    it('wraps the reason and preserves the original error', () => {
        const cause = new SyntaxError('unexpected token')
        const error = new Arc60BadJsonError('not canonical', cause)

        expect(error.message).toBe(
            'ARC-60 AUTH payload is not a valid canonical SIWA JSON: not canonical',
        )
        expect(error.metadata.params).toEqual({ reason: 'not canonical' })
        expect(error.originalError).toBe(cause)
    })
})

describe('Arc60DomainMismatchError', () => {
    it('is HIGH severity and names the mismatching domain', () => {
        const error = new Arc60DomainMismatchError('app.example.com')

        expect(error.message).toBe(
            'ARC-60 authenticatorData rpIdHash does not match sha256(app.example.com)',
        )
        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
        expect(error.metadata.params).toEqual({ domain: 'app.example.com' })
    })
})

describe('Arc60BadRequestError', () => {
    it('wraps the reason and preserves the original error', () => {
        const cause = new Error('oversized')
        const error = new Arc60BadRequestError('payload too large', cause)

        expect(error.message).toBe(
            'ARC-60 sign request is invalid: payload too large',
        )
        expect(error.metadata.params).toEqual({ reason: 'payload too large' })
        expect(error.originalError).toBe(cause)
    })
})

describe('Arc60FailedHdPathError', () => {
    it('omits the reason clause when no reason is given', () => {
        const error = new Arc60FailedHdPathError("m/44'/283'/0'/0/0")

        expect(error.message).toBe(
            "ARC-60 hdPath \"m/44'/283'/0'/0/0\" is invalid",
        )
        expect(error.metadata.params).toEqual({
            hdPath: "m/44'/283'/0'/0/0",
            reason: undefined,
        })
    })

    it('appends the reason clause when a reason is given', () => {
        const error = new Arc60FailedHdPathError('m/0', 'unknown coin type')

        expect(error.message).toBe(
            'ARC-60 hdPath "m/0" is invalid: unknown coin type',
        )
        expect(error.metadata.params).toEqual({
            hdPath: 'm/0',
            reason: 'unknown coin type',
        })
    })
})
