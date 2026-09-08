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
    CannotSignError,
    HardwareWalletError,
    SIGNING_ERROR_KEYS,
    SigningError,
    TransportError,
} from '../errors'

describe('pipeline error retryable flags', () => {
    it('marks unsupported_data_type hardware errors as non-retryable', () => {
        // Retrying an unsupported operation can never succeed.
        expect(
            new HardwareWalletError('unsupported_data_type').metadata.retryable,
        ).toBe(false)
    })

    it('keeps transient hardware reasons retryable', () => {
        expect(
            new HardwareWalletError('transport_unavailable').metadata.retryable,
        ).toBe(true)
        expect(
            new HardwareWalletError('signer_not_found').metadata.retryable,
        ).toBe(true)
        expect(
            new HardwareWalletError('registry_required').metadata.retryable,
        ).toBe(true)
    })

    it('SigningError accepts a retryable override and defaults to retryable', () => {
        expect(new SigningError('x').metadata.retryable).toBe(true)
        expect(
            new SigningError('x', undefined, { retryable: false }).metadata
                .retryable,
        ).toBe(false)
    })

    it('TransportError accepts a retryable override and defaults to retryable', () => {
        expect(new TransportError('x').metadata.retryable).toBe(true)
        expect(
            new TransportError('x', undefined, { retryable: false }).metadata
                .retryable,
        ).toBe(false)
    })
})

describe('signing errors carry user-facing keys', () => {
    it('SigningError forwards a declared messageKey with the signing title', () => {
        const error = new SigningError('x', undefined, {
            messageKey: 'errors.kms.key_not_found',
            params: { keyId: 'k' },
        })

        expect(error.metadata.messageKey).toBe('errors.kms.key_not_found')
        expect(error.metadata.titleKey).toBe('errors.signing.title')
        expect(error.metadata.params).toEqual({ keyId: 'k' })
    })

    it('SigningError without a messageKey stays key-less (generic banner)', () => {
        const error = new SigningError('x')

        expect(error.metadata.messageKey).toBeUndefined()
        expect(error.metadata.titleKey).toBeUndefined()
    })

    it('CannotSignError always renders the signing-specific body', () => {
        const error = new CannotSignError('ADDR', 'no keys')

        expect(error.metadata.messageKey).toBe(SIGNING_ERROR_KEYS.cannotSign)
        expect(error.metadata.titleKey).toBe(SIGNING_ERROR_KEYS.title)
        expect(error.metadata.params).toEqual({
            address: 'ADDR',
            reason: 'no keys',
        })
    })
})
