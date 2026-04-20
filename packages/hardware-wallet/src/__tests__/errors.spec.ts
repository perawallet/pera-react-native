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

import { describe, test, expect } from 'vitest'
import { ErrorCategory, ErrorSeverity } from '@perawallet/wallet-core-shared'
import {
    HardwareWalletConnectionError,
    HardwareWalletAppNotOpenError,
    HardwareWalletUserRejectedError,
    HardwareWalletDisconnectedError,
    HardwareWalletTimeoutError,
} from '../errors'

describe('hardware-wallet errors', () => {
    test('HardwareWalletConnectionError is HIGH severity, retryable, with prefixed message', () => {
        const cause = new Error('usb unplugged')
        const err = new HardwareWalletConnectionError('device offline', cause)

        expect(err.message).toBe(
            'Hardware wallet connection error: device offline',
        )
        expect(err.metadata.severity).toBe(ErrorSeverity.HIGH)
        expect(err.metadata.category).toBe(ErrorCategory.BLOCKCHAIN)
        expect(err.metadata.retryable).toBe(true)
        expect(err.originalError).toBe(cause)
    })

    test('HardwareWalletAppNotOpenError uses a default message when none provided', () => {
        const err = new HardwareWalletAppNotOpenError()

        expect(err.message).toBe(
            'Required app is not open on the hardware wallet device',
        )
        expect(err.metadata.severity).toBe(ErrorSeverity.MEDIUM)
        expect(err.metadata.retryable).toBe(true)
    })

    test('HardwareWalletAppNotOpenError respects custom messages', () => {
        const err = new HardwareWalletAppNotOpenError('open the Algorand app')
        expect(err.message).toBe('open the Algorand app')
    })

    test('HardwareWalletUserRejectedError is LOW severity and not retryable', () => {
        const err = new HardwareWalletUserRejectedError()
        expect(err.metadata.severity).toBe(ErrorSeverity.LOW)
        expect(err.metadata.retryable).toBe(false)
        expect(err.message).toBe(
            'Operation was rejected on the hardware wallet device',
        )
    })

    test('HardwareWalletDisconnectedError is HIGH severity and retryable', () => {
        const err = new HardwareWalletDisconnectedError()
        expect(err.metadata.severity).toBe(ErrorSeverity.HIGH)
        expect(err.metadata.retryable).toBe(true)
    })

    test('HardwareWalletTimeoutError formats the operation into the message', () => {
        const err = new HardwareWalletTimeoutError('sign transaction')
        expect(err.message).toBe(
            'Hardware wallet operation timed out: sign transaction',
        )
        expect(err.metadata.severity).toBe(ErrorSeverity.MEDIUM)
        expect(err.metadata.retryable).toBe(true)
    })
})
