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
    LedgerAddressMismatchError,
    LedgerAppNotOpenError,
    LedgerAppOutdatedError,
    LedgerBluetoothDisabledError,
    LedgerConnectionError,
    LedgerDeviceLockedError,
    LedgerDisconnectedError,
    LedgerLocationServicesDisabledError,
    LedgerNetworkError,
    LedgerNoAccountsFoundError,
    LedgerProviderNotFoundError,
    LedgerUsbMultipleDevicesError,
    LedgerUsbNoDeviceError,
    LedgerPermissionDeniedError,
    LedgerPublicKeyReadError,
    LedgerScanTimeoutError,
    LedgerSigningError,
    LedgerSigningFailedError,
    LedgerTimeoutError,
    LedgerTransmissionError,
    LedgerUnsupportedDeviceError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-core-ledger'
import { SigningError } from '../../pipeline/errors'
import {
    classifyLedgerErrorKind,
    isLedgerError,
} from '../classifyLedgerErrorKind'

describe('classifyLedgerErrorKind', () => {
    const cases: Array<[Error, ReturnType<typeof classifyLedgerErrorKind>]> = [
        [new LedgerBluetoothDisabledError(), 'bluetooth_disabled'],
        [new LedgerPermissionDeniedError(), 'bluetooth_permission'],
        [new LedgerScanTimeoutError('x'), 'scan_timeout'],
        [new LedgerUserRejectedError(), 'user_rejected'],
        [new LedgerAppNotOpenError(), 'app_not_open'],
        [new LedgerAddressMismatchError('A', 'B'), 'address_mismatch'],
        [
            new LedgerSigningError('Empty signature returned by Ledger device'),
            'signing_failed',
        ],
        [new LedgerSigningFailedError('x'), 'signing_failed'],
        [new LedgerTransmissionError('x'), 'transmission_error'],
        [new LedgerPublicKeyReadError(), 'public_key_read_failed'],
        [new LedgerNetworkError(), 'network_error'],
        [new LedgerUnsupportedDeviceError(), 'unsupported_device'],
        [new LedgerAppOutdatedError(), 'app_outdated'],
        [new LedgerDisconnectedError(), 'connection_lost'],
        [new LedgerTimeoutError('x'), 'timeout'],
        [new LedgerDeviceLockedError(), 'device_locked'],
        [new LedgerUsbNoDeviceError(), 'usb_no_device'],
        [new LedgerUsbMultipleDevicesError(), 'usb_multiple_devices'],
        [new LedgerNoAccountsFoundError(), 'no_accounts_found'],
        [
            new LedgerLocationServicesDisabledError(),
            'location_services_disabled',
        ],
        [new LedgerProviderNotFoundError('x'), 'provider_unavailable'],
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

describe('isLedgerError', () => {
    const ledgerErrors: Error[] = [
        new LedgerBluetoothDisabledError(),
        new LedgerPermissionDeniedError(),
        new LedgerScanTimeoutError('x'),
        new LedgerUserRejectedError(),
        new LedgerAppNotOpenError(),
        new LedgerAddressMismatchError('A', 'B'),
        new LedgerSigningError('x'),
        new LedgerSigningFailedError('x'),
        new LedgerTransmissionError('x'),
        new LedgerPublicKeyReadError(),
        new LedgerNetworkError(),
        new LedgerUnsupportedDeviceError(),
        new LedgerAppOutdatedError(),
        new LedgerDisconnectedError(),
        new LedgerTimeoutError('x'),
        new LedgerConnectionError('x'),
    ]

    it.each(ledgerErrors)('returns true for %s', error => {
        expect(isLedgerError(error)).toBe(true)
    })

    it('returns false for a generic Error', () => {
        expect(isLedgerError(new Error('boom'))).toBe(false)
    })

    it('returns false for a SigningError wrapping a non-device failure', () => {
        // The hardware strategy wraps ARC-60 validation failures (and any
        // other non-device error) in a SigningError before reaching onError.
        // Such a wrapper must NOT be treated as a device error, so the failure
        // surfaces inline rather than in the troubleshooting sheet.
        expect(isLedgerError(new SigningError('domain mismatch'))).toBe(false)
    })

    it('returns false for non-Error values', () => {
        expect(isLedgerError('string')).toBe(false)
        expect(isLedgerError(null)).toBe(false)
        expect(isLedgerError(undefined)).toBe(false)
    })
})
