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
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import {
    InvalidStateError,
    NotAllowedError,
    SecurityError,
} from '../authenticator/authenticator'
import {
    PasskeyAutofillUnavailableError,
    PasskeyKeyNotFoundError,
} from '../errors'

describe('passkey error taxonomy', () => {
    // The extension forwards these to pages by `name`, which must stay the
    // WebAuthn DOMException name rather than the class name AppError defaults to.
    it.each([
        [new SecurityError(), 'SecurityError'],
        [new InvalidStateError(), 'InvalidStateError'],
        [new NotAllowedError(), 'NotAllowedError'],
    ])('%o keeps its WebAuthn name as a validation AppError', (error, name) => {
        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(ErrorCategory.VALIDATION)
        expect(error.metadata.messageKey).toBeUndefined()
    })

    it('keeps the caller-supplied WebAuthn message', () => {
        expect(new NotAllowedError('custom').message).toBe('custom')
    })

    it('reports a missing autofill service as a non-recoverable AppError', () => {
        const error = new PasskeyAutofillUnavailableError()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe('PasskeyAutofillUnavailableError')
        expect(error.metadata.recoverable).toBe(false)
    })

    it('keeps the missing key id on PasskeyKeyNotFoundError', () => {
        const error = new PasskeyKeyNotFoundError('key-1')

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe('PasskeyKeyNotFoundError')
        expect(error.keyId).toBe('key-1')
        expect(error.metadata.category).toBe(ErrorCategory.KMS)
    })
})
