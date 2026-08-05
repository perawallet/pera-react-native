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
    WalletConnectConnectionTimeoutError,
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectPermissionError,
    WalletConnectSessionRequestExpiredError,
    WalletConnectSignRequestError,
} from '../errors'

describe('WalletConnectPermissionError', () => {
    it('should be instance of WalletConnectPermissionError', () => {
        const error = new WalletConnectPermissionError()
        expect(error).toBeInstanceOf(WalletConnectPermissionError)
        expect(error.message).toBe('Permission denied')
    })

    it('should accept original error', () => {
        const originalError = new Error('Original error')
        const error = new WalletConnectPermissionError(undefined, originalError)
        expect(error.originalError).toBe(originalError)
    })
})

describe('walletconnect error copy', () => {
    it.each([
        [
            WalletConnectInvalidSessionError,
            'errors.walletconnect.invalid_session_body',
        ],
        [
            WalletConnectSignRequestError,
            'errors.walletconnect.sign_request_body',
        ],
        [WalletConnectPermissionError, 'errors.walletconnect.permission_body'],
        [
            WalletConnectInvalidNetworkError,
            'errors.walletconnect.invalid_network_body',
        ],
        [
            WalletConnectConnectionTimeoutError,
            'errors.walletconnect.connection_timeout_body',
        ],
        [
            WalletConnectSessionRequestExpiredError,
            'errors.walletconnect.session_request_expired_body',
        ],
    ])('$name declares its own key', (ErrorClass, expectedKey) => {
        expect(new ErrorClass().metadata.messageKey).toBe(expectedKey)
    })

    it('falls back to walletconnect-specific copy, not errors.general', () => {
        const error = new WalletConnectError('internal detail')

        expect(error.metadata.messageKey).toBe('errors.walletconnect.body')
    })

    it('keeps the connection timeout retryable alongside its key', () => {
        const error = new WalletConnectConnectionTimeoutError()

        expect(error.metadata.retryable).toBe(true)
    })
})
