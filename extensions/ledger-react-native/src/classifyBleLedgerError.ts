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

import type { AppError, Nullable } from '@perawallet/wallet-core-shared'
import {
    classifyLedgerError,
    LedgerBluetoothDisabledError,
    LedgerDeviceNotFoundError,
    LedgerDisconnectedError,
    LedgerLocationServicesDisabledError,
    LedgerPermissionDeniedError,
    LedgerTimeoutError,
    type LedgerErrorClassifier,
} from '@perawallet/wallet-extension-ledger-shared'

/**
 * `@ledgerhq/react-native-hw-transport-ble` remaps ble-plx failures to an
 * `HwTransportError` before they reach us. The numeric `BleErrorCode` survives
 * both in `.type` (for the codes the lib maps) and appended to the message as
 * `". Origin: <code>"` (for every code) — we read both. Detected by `name` to
 * avoid coupling to the lib's class identity across versions.
 */
const isHwTransportError = (
    error: unknown,
): error is Error & { type?: string } =>
    error instanceof Error && error.name === 'HwTransportError'

/** `react-native-ble-plx` `BleErrorCode` values seen in the remapped message. */
const BLE_ERROR_CODE = {
    OPERATION_TIMED_OUT: 3,
    BLUETOOTH_POWERED_OFF: 102,
    DEVICE_CONNECTION_FAILED: 200,
    DEVICE_DISCONNECTED: 201,
    DEVICE_NOT_FOUND: 204,
    DEVICE_NOT_CONNECTED: 205,
    LOCATION_SERVICES_DISABLED: 601,
} as const

const parseBleOriginCode = (message: string): Nullable<number> => {
    const match = message.match(/Origin:\s*(\d+)\s*$/)
    return match ? Number(match[1]) : null
}

/**
 * `null` for anything unmapped, so the caller falls through to the shared
 * message heuristics rather than flattening every transport error to a
 * generic connection error.
 */
const classifyHwTransportError = (
    error: Error & { type?: string },
): Nullable<AppError> => {
    const originCode = parseBleOriginCode(error.message)

    if (
        error.type === 'LocationServicesDisabled' ||
        originCode === BLE_ERROR_CODE.LOCATION_SERVICES_DISABLED
    ) {
        return new LedgerLocationServicesDisabledError(error)
    }
    // The lib labels a location-*permission* failure
    // `LocationServicesUnauthorized`, so it routes to permission-denied.
    if (error.type === 'LocationServicesUnauthorized') {
        return new LedgerPermissionDeniedError(error)
    }
    if (originCode === BLE_ERROR_CODE.BLUETOOTH_POWERED_OFF) {
        return new LedgerBluetoothDisabledError(error)
    }
    // A connect attempt against a device that is off or out of range fails
    // with one of these rather than timing out, so they are what the "Ledger
    // not found" copy is actually driven by in practice.
    if (
        originCode === BLE_ERROR_CODE.DEVICE_CONNECTION_FAILED ||
        originCode === BLE_ERROR_CODE.DEVICE_NOT_FOUND ||
        originCode === BLE_ERROR_CODE.DEVICE_NOT_CONNECTED
    ) {
        return new LedgerDeviceNotFoundError(error)
    }
    // Losing an established link mid-exchange, as opposed to never reaching
    // the device at all.
    if (originCode === BLE_ERROR_CODE.DEVICE_DISCONNECTED) {
        return new LedgerDisconnectedError(error)
    }
    if (originCode === BLE_ERROR_CODE.OPERATION_TIMED_OUT) {
        return new LedgerTimeoutError('device communication', error)
    }
    return null
}

/**
 * Every error leaving the RN BLE transport — scan, connect and each APDU
 * exchange — must go through this rather than `classifyLedgerError`, which
 * knows nothing about ble-plx codes.
 */
export const classifyBleLedgerError: LedgerErrorClassifier = error =>
    (isHwTransportError(error) ? classifyHwTransportError(error) : null) ??
    classifyLedgerError(error)
