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

import { describe, it, expect, vi } from 'vitest'
import {
    ErrorCategory,
    isExpectedError,
    type AppError,
} from '@perawallet/wallet-core-shared'
import {
    classifyLedgerAppError,
    classifyLedgerError,
    LedgerAddressMismatchError,
    LedgerAppNotOpenError,
    LedgerAppOutdatedError,
    LedgerBluetoothDisabledError,
    LedgerConnectionError,
    LedgerDeviceBusyError,
    LedgerDeviceLockedError,
    LedgerDeviceNotFoundError,
    LedgerDevicePickerUnavailableError,
    LedgerDisconnectedError,
    LedgerLocationServicesDisabledError,
    LedgerNetworkError,
    LedgerNoAccountsFoundError,
    LedgerPermissionDeniedError,
    LedgerProviderNotFoundError,
    LedgerPublicKeyReadError,
    LedgerScanTimeoutError,
    LedgerSigningError,
    LedgerSigningFailedError,
    LedgerTimeoutError,
    LedgerTransmissionError,
    LedgerUnsupportedDeviceError,
    LedgerUsbMultipleDevicesError,
    LedgerUsbNoDeviceError,
    LedgerUserRejectedError,
} from '../errors'
import * as ledgerErrors from '../errors'

const createErrorWithStatus = (statusCode: number): Error => {
    const error = new Error('ledger error')
    ;(error as unknown as { statusCode: number }).statusCode = statusCode
    return error
}

describe('classifyLedgerError', () => {
    it('classifies 0x6985 as LedgerUserRejectedError', () => {
        const result = classifyLedgerError(createErrorWithStatus(0x6985))
        expect(result).toBeInstanceOf(LedgerUserRejectedError)
        // The swap flow's user-rejection classification matches by name to
        // avoid a value import — the name must survive minification.
        expect(result.name).toBe('LedgerUserRejectedError')
    })

    it("leaves an app's own non-standard reject code to its driver", () => {
        const result = classifyLedgerError(createErrorWithStatus(0x6986))
        expect(result).toBeInstanceOf(LedgerConnectionError)
    })

    it('classifies 0x5515 as LedgerDeviceLockedError', () => {
        const result = classifyLedgerError(createErrorWithStatus(0x5515))
        expect(result).toBeInstanceOf(LedgerDeviceLockedError)
    })

    it('classifies a LockedDeviceError-named remap as LedgerDeviceLockedError', () => {
        // @ledgerhq/errors delivers the locked state as a typed error in
        // some firmware/lib combinations instead of a bare status word.
        const error = new Error('Ledger device: Locked device (0x5515)')
        error.name = 'LockedDeviceError'
        expect(classifyLedgerError(error)).toBeInstanceOf(
            LedgerDeviceLockedError,
        )
    })

    it('classifies 0x6e00 as LedgerAppNotOpenError', () => {
        const result = classifyLedgerError(createErrorWithStatus(0x6e00))
        expect(result).toBeInstanceOf(LedgerAppNotOpenError)
    })

    it('classifies disconnect errors by message', () => {
        const error = new Error('Device disconnected unexpectedly')
        const result = classifyLedgerError(error)
        expect(result).toBeInstanceOf(LedgerDisconnectedError)
    })

    it('classifies "not connected" errors as disconnected', () => {
        const error = new Error('BLE device not connected')
        const result = classifyLedgerError(error)
        expect(result).toBeInstanceOf(LedgerDisconnectedError)
    })

    it('classifies timeout errors by message', () => {
        const error = new Error('Operation timeout')
        const result = classifyLedgerError(error)
        expect(result).toBeInstanceOf(LedgerTimeoutError)
    })

    it('classifies unknown Error as LedgerConnectionError', () => {
        const error = new Error('something went wrong')
        const result = classifyLedgerError(error)
        expect(result).toBeInstanceOf(LedgerConnectionError)
        expect(result.message).toContain('something went wrong')
    })

    it('classifies non-Error values as LedgerConnectionError', () => {
        const result = classifyLedgerError('string error')
        expect(result).toBeInstanceOf(LedgerConnectionError)
        expect(result.message).toContain('string error')
    })

    it('preserves original error reference', () => {
        const original = new Error('original')
        ;(original as unknown as { statusCode: number }).statusCode = 0x6e00
        const result = classifyLedgerError(original)
        expect(result.originalError).toBe(original)
    })

    it('classifies unknown status codes as LedgerConnectionError', () => {
        const result = classifyLedgerError(createErrorWithStatus(0x1234))
        expect(result).toBeInstanceOf(LedgerConnectionError)
    })
})

describe('classifyLedgerError with @zondax/ledger-js returnCode', () => {
    it('classifies returnCode 0x6985 as LedgerUserRejectedError', () => {
        expect(classifyLedgerError({ returnCode: 0x6985 })).toBeInstanceOf(
            LedgerUserRejectedError,
        )
    })

    it('classifies returnCode 0x6e00 as LedgerAppNotOpenError', () => {
        expect(classifyLedgerError({ returnCode: 0x6e00 })).toBeInstanceOf(
            LedgerAppNotOpenError,
        )
    })

    it('prefers statusCode when both are present', () => {
        expect(
            classifyLedgerError({ statusCode: 0x6985, returnCode: 0x9000 }),
        ).toBeInstanceOf(LedgerUserRejectedError)
    })
})

describe('classifyLedgerAppError', () => {
    const app = { appName: 'Fixture', userRejectedStatusCodes: [0x6999] }

    it("classifies the app's own reject code as LedgerUserRejectedError", () => {
        expect(
            classifyLedgerAppError(createErrorWithStatus(0x6999), app),
        ).toBeInstanceOf(LedgerUserRejectedError)
    })

    it('still classifies the standard reject code as LedgerUserRejectedError', () => {
        expect(
            classifyLedgerAppError({ returnCode: 0x6985 }, app),
        ).toBeInstanceOf(LedgerUserRejectedError)
    })

    it('names the app that is not open', () => {
        const original = createErrorWithStatus(0x6e00)

        const result = classifyLedgerAppError(original, app)

        expect(result).toBeInstanceOf(LedgerAppNotOpenError)
        expect(result.message).toBe(
            'Fixture app is not open on the Ledger device',
        )
        expect(result.originalError).toBe(original)
    })

    it('names the app that is outdated', () => {
        const result = classifyLedgerAppError({ returnCode: 0x6d00 }, app)

        expect(result).toBeInstanceOf(LedgerAppOutdatedError)
        expect(result.message).toBe(
            'The Ledger Fixture app must be updated to sign this request',
        )
    })

    it('passes an already-classified error through', () => {
        const classified = new LedgerDeviceLockedError()

        expect(classifyLedgerAppError(classified, app)).toBe(classified)
    })

    it('hands everything else to the fallback classifier', () => {
        const fallback = vi.fn(() => new LedgerDeviceLockedError())
        const error = createErrorWithStatus(0x1234)

        const result = classifyLedgerAppError(error, app, fallback)

        expect(fallback).toHaveBeenCalledWith(error)
        expect(result).toBeInstanceOf(LedgerDeviceLockedError)
    })

    it("does not treat another app's reject code as a rejection", () => {
        expect(
            classifyLedgerAppError(createErrorWithStatus(0x6986), app),
        ).toBeInstanceOf(LedgerConnectionError)
    })
})

describe('classifyLedgerError with HwTransportError', () => {
    it('leaves ble-plx origin codes to the BLE transport classifier', () => {
        // The shared classifier is transport-neutral; mapping these codes
        // belongs to the RN BLE transport.
        const error = new Error('BleError. Origin: 601')
        error.name = 'HwTransportError'
        expect(classifyLedgerError(error)).toBeInstanceOf(LedgerConnectionError)
    })
})

describe('classifyLedgerError with @ledgerhq/errors typed errors', () => {
    const createNamedError = (name: string, message = 'lib error'): Error => {
        const error = new Error(message)
        error.name = name
        return error
    }

    it.each([
        ['CantOpenDevice', LedgerDeviceNotFoundError],
        ['DisconnectedDevice', LedgerDisconnectedError],
        ['DisconnectedDeviceDuringOperation', LedgerDisconnectedError],
        ['TransportRaceCondition', LedgerDeviceBusyError],
        ['UnresponsiveDeviceError', LedgerTimeoutError],
        ['LockedDeviceError', LedgerDeviceLockedError],
        ['NotFoundError', LedgerDeviceNotFoundError],
        ['TransportOpenUserCancelled', LedgerDeviceNotFoundError],
    ] as const)('maps %s to the matching typed error', (name, expected) => {
        expect(classifyLedgerError(createNamedError(name))).toBeInstanceOf(
            expected,
        )
    })

    it('matches by name before the message heuristics, so wording cannot win', () => {
        // Message says "timeout", but the class identity says busy.
        const error = createNamedError(
            'TransportRaceCondition',
            'exchange timeout while another exchange is pending',
        )
        expect(classifyLedgerError(error)).toBeInstanceOf(LedgerDeviceBusyError)
    })

    it('classifies a busy message as LedgerDeviceBusyError when untyped', () => {
        expect(
            classifyLedgerError(new Error('Ledger device is busy')),
        ).toBeInstanceOf(LedgerDeviceBusyError)
    })

    it('classifies 0x6d00 (INS_NOT_SUPPORTED) as LedgerAppOutdatedError', () => {
        // The installed app predates the instruction we sent — the
        // only version signal the device volunteers.
        expect(
            classifyLedgerError(createErrorWithStatus(0x6d00)),
        ).toBeInstanceOf(LedgerAppOutdatedError)
    })
})

describe('new typed Ledger errors', () => {
    it('LedgerBluetoothDisabledError is a retryable AppError with BLOCKCHAIN category', () => {
        const error = new LedgerBluetoothDisabledError()
        expect(error.message).toContain('Bluetooth')
        expect(error.metadata.retryable).toBe(true)
        expect(error.metadata.category).toBe(ErrorCategory.BLOCKCHAIN)
    })

    it('LedgerPermissionDeniedError is a retryable AppError', () => {
        const error = new LedgerPermissionDeniedError()
        expect(error.message).toContain('permission')
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerScanTimeoutError carries the timeout reason', () => {
        const error = new LedgerScanTimeoutError('scan timed out after 15s')
        expect(error.message).toContain('scan timed out')
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerSigningFailedError wraps a cause', () => {
        const cause = new Error('underlying SDK error')
        const error = new LedgerSigningFailedError(
            'attachSignature failed',
            cause,
        )
        expect(error.originalError).toBe(cause)
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerTransmissionError indicates a write characteristic failure', () => {
        const error = new LedgerTransmissionError('write characteristic failed')
        expect(error.message).toContain('write')
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerPublicKeyReadError represents a public-key read failure', () => {
        const error = new LedgerPublicKeyReadError()
        expect(error.message.toLowerCase()).toContain('public key')
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerNetworkError represents an indexer/network failure', () => {
        const error = new LedgerNetworkError()
        expect(error.message.toLowerCase()).toContain('network')
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerUnsupportedDeviceError is not retryable', () => {
        const error = new LedgerUnsupportedDeviceError()
        expect(error.message.toLowerCase()).toContain('not supported')
        expect(error.metadata.retryable).toBe(false)
    })

    it('LedgerDeviceNotFoundError is retryable — powering the device on fixes it', () => {
        const error = new LedgerDeviceNotFoundError()
        expect(error.message.toLowerCase()).toContain('reached')
        expect(error.metadata.retryable).toBe(true)
    })

    it('LedgerDeviceBusyError is retryable once the current action finishes', () => {
        const error = new LedgerDeviceBusyError()
        expect(error.message.toLowerCase()).toContain('busy')
        expect(error.metadata.retryable).toBe(true)
    })
})

describe('expected-error classification', () => {
    // Exhaustive on purpose: adding a Ledger error class must fail this suite
    // until someone decides whether it is our defect or the environment's.
    const EXPECTED: Array<[string, AppError]> = [
        ['LedgerDeviceNotFoundError', new LedgerDeviceNotFoundError()],
        [
            'LedgerDevicePickerUnavailableError',
            new LedgerDevicePickerUnavailableError(),
        ],
        ['LedgerDeviceBusyError', new LedgerDeviceBusyError()],
        ['LedgerDeviceLockedError', new LedgerDeviceLockedError()],
        ['LedgerAppNotOpenError', new LedgerAppNotOpenError()],
        ['LedgerDisconnectedError', new LedgerDisconnectedError()],
        ['LedgerTimeoutError', new LedgerTimeoutError('device communication')],
        [
            'LedgerScanTimeoutError',
            new LedgerScanTimeoutError('scan timed out'),
        ],
        ['LedgerUserRejectedError', new LedgerUserRejectedError()],
        ['LedgerBluetoothDisabledError', new LedgerBluetoothDisabledError()],
        ['LedgerPermissionDeniedError', new LedgerPermissionDeniedError()],
        [
            'LedgerLocationServicesDisabledError',
            new LedgerLocationServicesDisabledError(),
        ],
        ['LedgerConnectionError', new LedgerConnectionError('offline')],
        ['LedgerNetworkError', new LedgerNetworkError()],
        ['LedgerUsbNoDeviceError', new LedgerUsbNoDeviceError()],
        ['LedgerAppOutdatedError', new LedgerAppOutdatedError()],
        ['LedgerNoAccountsFoundError', new LedgerNoAccountsFoundError()],
        ['LedgerUnsupportedDeviceError', new LedgerUnsupportedDeviceError()],
    ]

    const REPORTABLE: Array<[string, AppError]> = [
        [
            'LedgerAddressMismatchError',
            new LedgerAddressMismatchError('a', 'b'),
        ],
        ['LedgerSigningError', new LedgerSigningError('failed')],
        ['LedgerSigningFailedError', new LedgerSigningFailedError('failed')],
        ['LedgerTransmissionError', new LedgerTransmissionError('failed')],
        ['LedgerPublicKeyReadError', new LedgerPublicKeyReadError()],
        [
            'LedgerProviderNotFoundError',
            new LedgerProviderNotFoundError('no provider'),
        ],
        ['LedgerUsbMultipleDevicesError', new LedgerUsbMultipleDevicesError()],
    ]

    it.each(EXPECTED)('%s is expected', (_name, error) => {
        expect(isExpectedError(error)).toBe(true)
    })

    it.each(REPORTABLE)('%s stays reportable', (_name, error) => {
        expect(isExpectedError(error)).toBe(false)
    })

    it('covers every exported Ledger error class', () => {
        const covered = new Set(
            [...EXPECTED, ...REPORTABLE].map(([name]) => name),
        )
        const exported = Object.keys(ledgerErrors).filter(
            // `\w+` skips the abstract `LedgerError` base.
            key => /^Ledger\w+Error$/.test(key),
        )
        expect(exported.filter(name => !covered.has(name))).toEqual([])
    })
})
