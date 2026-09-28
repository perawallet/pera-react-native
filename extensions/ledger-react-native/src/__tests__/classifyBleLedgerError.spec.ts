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
    LedgerAppNotOpenError,
    LedgerBluetoothDisabledError,
    LedgerConnectionError,
    LedgerDeviceNotFoundError,
    LedgerDisconnectedError,
    LedgerLocationServicesDisabledError,
    LedgerPermissionDeniedError,
    LedgerTimeoutError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-extension-ledger-shared'
import { classifyBleLedgerError } from '../classifyBleLedgerError'

describe('classifyBleLedgerError with HwTransportError', () => {
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
        const result = classifyBleLedgerError(
            createHwTransportError('LocationServicesDisabled', 601),
        )
        expect(result).toBeInstanceOf(LedgerLocationServicesDisabledError)
    })

    it('classifies BleErrorCode 601 by message origin even without a typed .type', () => {
        const result = classifyBleLedgerError(
            createHwTransportError(undefined, 601),
        )
        expect(result).toBeInstanceOf(LedgerLocationServicesDisabledError)
    })

    it('classifies LocationServicesUnauthorized type as LedgerPermissionDeniedError', () => {
        const result = classifyBleLedgerError(
            createHwTransportError('LocationServicesUnauthorized', 101),
        )
        expect(result).toBeInstanceOf(LedgerPermissionDeniedError)
    })

    it('classifies BleErrorCode 102 (BluetoothPoweredOff) as LedgerBluetoothDisabledError', () => {
        const result = classifyBleLedgerError(
            createHwTransportError('Unknown', 102),
        )
        expect(result).toBeInstanceOf(LedgerBluetoothDisabledError)
    })

    it('falls back to LedgerConnectionError for unmapped transport errors', () => {
        const result = classifyBleLedgerError(
            createHwTransportError('Unknown', 600),
        )
        expect(result).toBeInstanceOf(LedgerConnectionError)
    })

    it('still routes an unmapped transport error through the disconnect heuristic', () => {
        const result = classifyBleLedgerError(
            createHwTransportError('Unknown', 201, 'Device was disconnected'),
        )
        expect(result).toBeInstanceOf(LedgerDisconnectedError)
    })

    it('preserves the original error reference', () => {
        const original = createHwTransportError('LocationServicesDisabled', 601)
        const result = classifyBleLedgerError(original)
        expect(result.originalError).toBe(original)
    })

    // A powered-off or out-of-range device fails the connect with one of these
    // rather than hanging, so they are what drives the "Ledger not found" copy.
    it.each([200, 204, 205])(
        'classifies BleErrorCode %i as LedgerDeviceNotFoundError',
        code => {
            expect(
                classifyBleLedgerError(createHwTransportError(undefined, code)),
            ).toBeInstanceOf(LedgerDeviceNotFoundError)
        },
    )

    it('classifies BleErrorCode 201 (DeviceDisconnected) as LedgerDisconnectedError', () => {
        expect(
            classifyBleLedgerError(
                createHwTransportError(undefined, 201, 'BleError'),
            ),
        ).toBeInstanceOf(LedgerDisconnectedError)
    })

    it('classifies BleErrorCode 3 (OperationTimedOut) as LedgerTimeoutError', () => {
        expect(
            classifyBleLedgerError(createHwTransportError(undefined, 3)),
        ).toBeInstanceOf(LedgerTimeoutError)
    })
})

describe('classifyBleLedgerError fallback', () => {
    it('defers non-transport errors to the shared classifier', () => {
        expect(classifyBleLedgerError({ statusCode: 0x6986 })).toBeInstanceOf(
            LedgerUserRejectedError,
        )
    })

    it('passes an already-classified error through unchanged', () => {
        const classified = new LedgerAppNotOpenError()
        expect(classifyBleLedgerError(classified)).toBe(classified)
    })
})
