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
import { ErrorCategory } from '@perawallet/wallet-core-shared'
import {
    classifyLedgerError,
    LedgerDeviceLockedError,
    LedgerUserRejectedError,
    LedgerAppNotOpenError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerConnectionError,
    LedgerBluetoothDisabledError,
    LedgerLocationServicesDisabledError,
    LedgerPermissionDeniedError,
    LedgerScanTimeoutError,
    LedgerSigningFailedError,
    LedgerTransmissionError,
    LedgerPublicKeyReadError,
    LedgerNetworkError,
    LedgerUnsupportedDeviceError,
} from '../errors'

const createErrorWithStatus = (statusCode: number): Error => {
    const error = new Error('ledger error')
    ;(error as unknown as { statusCode: number }).statusCode = statusCode
    return error
}

describe('classifyLedgerError', () => {
    it('classifies 0x6986 as LedgerUserRejectedError', () => {
        const result = classifyLedgerError(createErrorWithStatus(0x6986))
        expect(result).toBeInstanceOf(LedgerUserRejectedError)
        // The swap flow's user-rejection classification matches by name to
        // avoid a value import — the name must survive minification.
        expect(result.name).toBe('LedgerUserRejectedError')
    })

    it('classifies 0x6985 (legacy) as LedgerUserRejectedError', () => {
        const result = classifyLedgerError(createErrorWithStatus(0x6985))
        expect(result).toBeInstanceOf(LedgerUserRejectedError)
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
    it('classifies returnCode 0x6986 as LedgerUserRejectedError', () => {
        expect(classifyLedgerError({ returnCode: 0x6986 })).toBeInstanceOf(
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
            classifyLedgerError({ statusCode: 0x6986, returnCode: 0x9000 }),
        ).toBeInstanceOf(LedgerUserRejectedError)
    })
})

describe('classifyLedgerError with HwTransportError (BLE scan/connect)', () => {
    // Mirrors what @ledgerhq/react-native-hw-transport-ble emits after
    // remapping a react-native-ble-plx BleError: name === 'HwTransportError',
    // an optional `.type`, and the numeric BleErrorCode appended to the message.
    const createHwTransportError = (
        type: string | undefined,
        originCode: number,
        message = 'BleError',
    ): Error => {
        const error = new Error(`${message}. Origin: ${originCode}`)
        error.name = 'HwTransportError'
        if (type !== undefined) {
            ;(error as unknown as { type: string }).type = type
        }
        return error
    }

    it('classifies LocationServicesDisabled type as LedgerLocationServicesDisabledError', () => {
        const result = classifyLedgerError(
            createHwTransportError('LocationServicesDisabled', 601),
        )
        expect(result).toBeInstanceOf(LedgerLocationServicesDisabledError)
    })

    it('classifies BleErrorCode 601 by message origin even without a typed .type', () => {
        const result = classifyLedgerError(
            createHwTransportError(undefined, 601),
        )
        expect(result).toBeInstanceOf(LedgerLocationServicesDisabledError)
    })

    it('classifies LocationServicesUnauthorized type as LedgerPermissionDeniedError', () => {
        const result = classifyLedgerError(
            createHwTransportError('LocationServicesUnauthorized', 101),
        )
        expect(result).toBeInstanceOf(LedgerPermissionDeniedError)
    })

    it('classifies BleErrorCode 102 (BluetoothPoweredOff) as LedgerBluetoothDisabledError', () => {
        const result = classifyLedgerError(
            createHwTransportError('Unknown', 102),
        )
        expect(result).toBeInstanceOf(LedgerBluetoothDisabledError)
    })

    it('falls back to LedgerConnectionError for unmapped transport errors', () => {
        const result = classifyLedgerError(
            createHwTransportError('Unknown', 600),
        )
        expect(result).toBeInstanceOf(LedgerConnectionError)
    })

    it('still routes an unmapped transport error through the disconnect heuristic', () => {
        const result = classifyLedgerError(
            createHwTransportError('Unknown', 201, 'Device was disconnected'),
        )
        expect(result).toBeInstanceOf(LedgerDisconnectedError)
    })

    it('preserves the original error reference', () => {
        const original = createHwTransportError('LocationServicesDisabled', 601)
        const result = classifyLedgerError(original)
        expect(result.originalError).toBe(original)
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
})
