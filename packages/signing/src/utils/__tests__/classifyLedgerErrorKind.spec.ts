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
    LedgerAddressMismatchError,
    LedgerAppNotOpenError,
    LedgerBluetoothDisabledError,
    LedgerConnectionError,
    LedgerDisconnectedError,
    LedgerNetworkError,
    LedgerPermissionDeniedError,
    LedgerPublicKeyReadError,
    LedgerScanTimeoutError,
    LedgerSigningFailedError,
    LedgerTimeoutError,
    LedgerTransmissionError,
    LedgerUnsupportedDeviceError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-core-ledger'
import { classifyLedgerErrorKind } from '../classifyLedgerErrorKind'

describe('classifyLedgerErrorKind', () => {
    const cases: Array<[Error, ReturnType<typeof classifyLedgerErrorKind>]> = [
        [new LedgerBluetoothDisabledError(), 'bluetooth_disabled'],
        [new LedgerPermissionDeniedError(), 'bluetooth_permission'],
        [new LedgerScanTimeoutError('x'), 'scan_timeout'],
        [new LedgerUserRejectedError(), 'user_rejected'],
        [new LedgerAppNotOpenError(), 'app_not_open'],
        [new LedgerAddressMismatchError('A', 'B'), 'address_mismatch'],
        [new LedgerSigningFailedError('x'), 'signing_failed'],
        [new LedgerTransmissionError('x'), 'transmission_error'],
        [new LedgerPublicKeyReadError(), 'public_key_read_failed'],
        [new LedgerNetworkError(), 'network_error'],
        [new LedgerUnsupportedDeviceError(), 'unsupported_device'],
        [new LedgerDisconnectedError(), 'connection_lost'],
        [new LedgerTimeoutError('x'), 'scan_timeout'],
        [new LedgerConnectionError('x'), 'connection_failed'],
    ]

    it.each(cases)('classifies %s as %s', (error, expected) => {
        expect(classifyLedgerErrorKind(error)).toBe(expected)
    })

    it('falls back to connection_failed for unknown errors', () => {
        expect(classifyLedgerErrorKind(new Error('???'))).toBe(
            'connection_failed',
        )
    })

    it('falls back to connection_failed for non-Error values', () => {
        expect(classifyLedgerErrorKind('string')).toBe('connection_failed')
        expect(classifyLedgerErrorKind(null)).toBe('connection_failed')
        expect(classifyLedgerErrorKind(undefined)).toBe('connection_failed')
    })
})
