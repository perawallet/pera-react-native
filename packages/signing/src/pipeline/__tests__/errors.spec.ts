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
import { HardwareWalletError, SigningError } from '../errors'

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
})
