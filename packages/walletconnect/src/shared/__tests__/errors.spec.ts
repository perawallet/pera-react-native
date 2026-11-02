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
import { isExpectedError } from '@perawallet/wallet-core-shared'
import {
    WalletConnectBridgeConnectionError,
    WalletConnectConnectionTimeoutError,
    WalletConnectError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectPermissionError,
    WalletConnectSessionRequestExpiredError,
    WalletConnectSignRequestError,
    WalletConnectUnsupportedChainsError,
    WalletConnectUnsupportedMethodError,
    WalletConnectUnsupportedNetworkError,
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
        {
            ErrorClass: WalletConnectInvalidSessionError,
            expectedKey: 'errors.walletconnect.invalid_session_body',
        },
        {
            ErrorClass: WalletConnectSignRequestError,
            expectedKey: 'errors.walletconnect.sign_request_body',
        },
        {
            ErrorClass: WalletConnectInvalidNetworkError,
            expectedKey: 'errors.walletconnect.invalid_network_body',
        },
        {
            ErrorClass: WalletConnectConnectionTimeoutError,
            expectedKey: 'errors.walletconnect.connection_timeout_body',
        },
        {
            ErrorClass: WalletConnectSessionRequestExpiredError,
            expectedKey: 'errors.walletconnect.session_request_expired_body',
        },
    ])(
        '$ErrorClass.name declares its own key',
        ({ ErrorClass, expectedKey }) => {
            expect(new ErrorClass().metadata.messageKey).toBe(expectedKey)
        },
    )

    it('falls back to walletconnect-specific copy, not errors.general', () => {
        const error = new WalletConnectError('internal detail')

        expect(error.metadata.messageKey).toBe('errors.walletconnect.body')
    })

    it('keeps the connection timeout retryable alongside its key', () => {
        const error = new WalletConnectConnectionTimeoutError()

        expect(error.metadata.retryable).toBe(true)
    })
})

describe('WalletConnect error classification', () => {
    it('a bridge connection failure is expected', () => {
        expect(isExpectedError(new WalletConnectBridgeConnectionError())).toBe(
            true,
        )
    })

    it('a connection timeout is expected', () => {
        expect(isExpectedError(new WalletConnectConnectionTimeoutError())).toBe(
            true,
        )
    })

    it('a sign-request failure stays reportable', () => {
        expect(isExpectedError(new WalletConnectSignRequestError())).toBe(false)
    })

    it('an invalid session stays reportable', () => {
        expect(isExpectedError(new WalletConnectInvalidSessionError())).toBe(
            false,
        )
    })
})

describe('declined-request errors', () => {
    it('carries what the copy interpolates, and is expected', () => {
        const method = new WalletConnectUnsupportedMethodError(
            'Uniswap',
            'eth_sign',
        )
        const network = new WalletConnectUnsupportedNetworkError(
            'Uniswap',
            '130',
        )

        expect(method.metadata).toMatchObject({
            messageKey: 'errors.walletconnect.unsupported_method_body',
            params: { dappName: 'Uniswap', method: 'eth_sign' },
        })
        expect(network.metadata).toMatchObject({
            messageKey: 'errors.walletconnect.unsupported_network_body',
            params: { dappName: 'Uniswap', chainId: '130' },
        })
        expect(
            new WalletConnectUnsupportedChainsError().metadata,
        ).toMatchObject({
            messageKey: 'errors.walletconnect.unsupported_chains_body',
        })
        expect(isExpectedError(new WalletConnectUnsupportedChainsError())).toBe(
            true,
        )
        expect(isExpectedError(method)).toBe(true)
        expect(isExpectedError(network)).toBe(true)
    })
})
