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
    AppError,
    ErrorCategory,
    ErrorSeverity,
    type ErrorMetadata,
} from '@perawallet/wallet-core-shared'
import * as ledgerErrors from '../errors'

type ErrorClass = new (...args: never[]) => AppError

type Row = {
    ErrorClass: ErrorClass
    args: string[]
    message: string
    metadata: ErrorMetadata
}

const { HIGH, MEDIUM, LOW } = ErrorSeverity

const meta = (
    severity: ErrorSeverity,
    retryable: boolean,
    extra: Partial<ErrorMetadata> = {},
): ErrorMetadata => ({
    severity,
    category: ErrorCategory.BLOCKCHAIN,
    recoverable: true,
    retryable,
    ...extra,
})

const expected = { expected: true }

// The literal contract each class must keep: `name`, `message` and
// `metadata` are matched on by the UI presets, crash reporting and the swap
// flow, so any drift here is a behaviour change.
const ROWS: Record<string, Row> = {
    LedgerConnectionError: {
        ErrorClass: ledgerErrors.LedgerConnectionError,
        args: ['offline'],
        message: 'Ledger connection error: offline',
        metadata: meta(HIGH, true, expected),
    },
    LedgerAppNotOpenError: {
        ErrorClass: ledgerErrors.LedgerAppNotOpenError,
        args: [],
        message: 'Algorand app is not open on the Ledger device',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerDeviceLockedError: {
        ErrorClass: ledgerErrors.LedgerDeviceLockedError,
        args: [],
        message: 'The Ledger device is locked',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerDeviceNotFoundError: {
        ErrorClass: ledgerErrors.LedgerDeviceNotFoundError,
        args: [],
        message: 'No Ledger device could be reached',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerDeviceBusyError: {
        ErrorClass: ledgerErrors.LedgerDeviceBusyError,
        args: [],
        message: 'The Ledger device is busy with another operation',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerUsbNoDeviceError: {
        ErrorClass: ledgerErrors.LedgerUsbNoDeviceError,
        args: [],
        message: 'No Ledger connected over USB',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerUsbMultipleDevicesError: {
        ErrorClass: ledgerErrors.LedgerUsbMultipleDevicesError,
        args: [],
        message: 'Multiple Ledger devices are connected over USB',
        metadata: meta(MEDIUM, true),
    },
    LedgerUserRejectedError: {
        ErrorClass: ledgerErrors.LedgerUserRejectedError,
        args: [],
        message: 'Operation was rejected on the Ledger device',
        metadata: meta(LOW, false, expected),
    },
    LedgerDisconnectedError: {
        ErrorClass: ledgerErrors.LedgerDisconnectedError,
        args: [],
        message: 'Ledger device disconnected unexpectedly',
        metadata: meta(HIGH, true, expected),
    },
    LedgerTimeoutError: {
        ErrorClass: ledgerErrors.LedgerTimeoutError,
        args: ['device communication'],
        message: 'Ledger operation timed out: device communication',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerAddressMismatchError: {
        ErrorClass: ledgerErrors.LedgerAddressMismatchError,
        args: ['AAA', 'BBB'],
        message: 'Ledger address mismatch: expected AAA but got BBB',
        metadata: meta(HIGH, false, {
            params: { expected: 'AAA', actual: 'BBB' },
        }),
    },
    LedgerSigningError: {
        ErrorClass: ledgerErrors.LedgerSigningError,
        args: ['Empty signature returned'],
        message: 'Ledger signing error: Empty signature returned',
        metadata: meta(HIGH, true),
    },
    LedgerProviderNotFoundError: {
        ErrorClass: ledgerErrors.LedgerProviderNotFoundError,
        args: ['no usb provider'],
        message: 'Ledger provider not found: no usb provider',
        metadata: meta(HIGH, false, { params: { reason: 'no usb provider' } }),
    },
    LedgerNoAccountsFoundError: {
        ErrorClass: ledgerErrors.LedgerNoAccountsFoundError,
        args: [],
        message: 'No accounts were found on this Ledger device',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerBluetoothDisabledError: {
        ErrorClass: ledgerErrors.LedgerBluetoothDisabledError,
        args: [],
        message:
            'Bluetooth must be enabled to communicate with a Ledger device',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerPermissionDeniedError: {
        ErrorClass: ledgerErrors.LedgerPermissionDeniedError,
        args: [],
        message:
            'Bluetooth scan permission is required to search for nearby Ledger devices',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerLocationServicesDisabledError: {
        ErrorClass: ledgerErrors.LedgerLocationServicesDisabledError,
        args: [],
        message:
            'Location services must be enabled to search for nearby Ledger devices',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerScanTimeoutError: {
        ErrorClass: ledgerErrors.LedgerScanTimeoutError,
        args: ['no devices'],
        message: 'Ledger scan timed out: no devices',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerSigningFailedError: {
        ErrorClass: ledgerErrors.LedgerSigningFailedError,
        args: ['attachSignature failed'],
        message: 'Ledger signing failed: attachSignature failed',
        metadata: meta(HIGH, true),
    },
    LedgerTransmissionError: {
        ErrorClass: ledgerErrors.LedgerTransmissionError,
        args: ['write failed'],
        message: 'Ledger transmission failed: write failed',
        metadata: meta(HIGH, true),
    },
    LedgerPublicKeyReadError: {
        ErrorClass: ledgerErrors.LedgerPublicKeyReadError,
        args: [],
        message: 'Failed to read public key from Ledger device',
        metadata: meta(HIGH, true),
    },
    LedgerNetworkError: {
        ErrorClass: ledgerErrors.LedgerNetworkError,
        args: [],
        message: 'Network error during Ledger operation',
        metadata: meta(MEDIUM, true, expected),
    },
    LedgerUnsupportedDeviceError: {
        ErrorClass: ledgerErrors.LedgerUnsupportedDeviceError,
        args: [],
        message: 'This Ledger device is not supported',
        metadata: meta(HIGH, false, expected),
    },
    LedgerAppOutdatedError: {
        ErrorClass: ledgerErrors.LedgerAppOutdatedError,
        args: [],
        message: 'The Ledger Algorand app must be updated to sign this request',
        metadata: meta(MEDIUM, false, expected),
    },
}

const construct = ({ ErrorClass, args }: Row, cause?: Error): AppError => {
    const Ctor = ErrorClass as unknown as new (...a: unknown[]) => AppError
    return new Ctor(...args, cause)
}

describe('Ledger error classes', () => {
    it('has a contract row for every exported Ledger error class', () => {
        const exported = Object.keys(ledgerErrors).filter(
            // `\w+` skips the abstract `LedgerError` base.
            key => /^Ledger\w+Error$/.test(key),
        )
        expect(exported.sort()).toEqual(Object.keys(ROWS).sort())
    })

    it.each(Object.entries(ROWS))(
        '%s keeps its name, message and metadata',
        (name, row) => {
            const cause = new Error('cause')
            const error = construct(row, cause)

            expect(error).toBeInstanceOf(row.ErrorClass)
            expect(error).toBeInstanceOf(ledgerErrors.LedgerError)
            expect(error).toBeInstanceOf(AppError)
            expect(error).toBeInstanceOf(Error)
            expect(error.name).toBe(name)
            expect(row.ErrorClass.name).toBe(name)
            expect(error.message).toBe(row.message)
            expect(error.metadata).toStrictEqual(row.metadata)
            expect(error.originalError).toBe(cause)
        },
    )

    it.each(Object.entries(ROWS))(
        '%s leaves originalError unset when no cause is given',
        (_name, row) => {
            expect(construct(row).originalError).toBeUndefined()
        },
    )

    it('gives every class its own instanceof identity', () => {
        const rows = Object.values(ROWS)
        for (const row of rows) {
            const error = construct(row)
            for (const other of rows) {
                if (other === row) continue
                expect(error).not.toBeInstanceOf(other.ErrorClass)
            }
        }
    })
})
