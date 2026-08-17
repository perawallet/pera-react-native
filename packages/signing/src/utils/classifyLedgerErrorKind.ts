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

import {
    LedgerAddressMismatchError,
    LedgerAppNotOpenError,
    LedgerAppOutdatedError,
    LedgerBluetoothDisabledError,
    LedgerConnectionError,
    LedgerDeviceBusyError,
    LedgerDeviceLockedError,
    LedgerDeviceNotFoundError,
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
} from '@perawallet/wallet-core-ledger'
import type { LedgerErrorPresetKind } from '../types/ledgerErrorPresetKind'

/**
 * Every typed Ledger error class. Kept in one place so both the
 * UI-preset classifier ({@link classifyLedgerErrorKind}) and the
 * device-error predicate ({@link isLedgerError}) stay in sync.
 */
const LEDGER_ERROR_CLASSES = [
    LedgerBluetoothDisabledError,
    LedgerPermissionDeniedError,
    LedgerScanTimeoutError,
    LedgerUserRejectedError,
    LedgerAppNotOpenError,
    LedgerAddressMismatchError,
    LedgerSigningError,
    LedgerSigningFailedError,
    LedgerTransmissionError,
    LedgerPublicKeyReadError,
    LedgerNetworkError,
    LedgerAppOutdatedError,
    LedgerUnsupportedDeviceError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerDeviceLockedError,
    LedgerDeviceNotFoundError,
    LedgerDeviceBusyError,
    LedgerUsbNoDeviceError,
    LedgerUsbMultipleDevicesError,
    LedgerNoAccountsFoundError,
    LedgerLocationServicesDisabledError,
    LedgerProviderNotFoundError,
    LedgerConnectionError,
] as const

/**
 * True only for genuine Ledger device/transport errors (the typed classes
 * thrown by the Ledger extension). Used to decide whether a thrown error
 * should drive the hardware-signing overlay/troubleshooting surface
 * (`true`) or fall through to the generic inline error view (`false`).
 *
 * Non-device failures — ARC-60 validation errors, generic JS errors, or a
 * `SigningError` wrapping one — return `false` so they surface inline in the
 * sign-request sheet rather than masquerading as a connection problem.
 */
export const isLedgerError = (error: unknown): boolean =>
    LEDGER_ERROR_CLASSES.some(LedgerError => error instanceof LedgerError)

/**
 * Strategy-agnostic classifier that turns a thrown error into the
 * UI-facing preset kind. Lives in the signing package (not the mobile
 * module) so the lifecycle hook can run without a UI dependency.
 */
export const classifyLedgerErrorKind = (
    error: unknown,
): LedgerErrorPresetKind => {
    if (!(error instanceof Error)) return 'connection_failed'
    if (error instanceof LedgerBluetoothDisabledError)
        return 'bluetooth_disabled'
    if (error instanceof LedgerPermissionDeniedError)
        return 'bluetooth_permission'
    if (error instanceof LedgerScanTimeoutError) return 'scan_timeout'
    if (error instanceof LedgerUserRejectedError) return 'user_rejected'
    if (error instanceof LedgerAppNotOpenError) return 'app_not_open'
    if (error instanceof LedgerAddressMismatchError) return 'address_mismatch'
    if (error instanceof LedgerSigningError) return 'signing_failed'
    if (error instanceof LedgerSigningFailedError) return 'signing_failed'
    if (error instanceof LedgerTransmissionError) return 'transmission_error'
    if (error instanceof LedgerPublicKeyReadError)
        return 'public_key_read_failed'
    if (error instanceof LedgerNetworkError) return 'network_error'
    if (error instanceof LedgerAppOutdatedError) return 'app_outdated'
    if (error instanceof LedgerUnsupportedDeviceError)
        return 'unsupported_device'
    if (error instanceof LedgerDisconnectedError) return 'connection_lost'
    if (error instanceof LedgerTimeoutError) return 'timeout'
    if (error instanceof LedgerDeviceLockedError) return 'device_locked'
    if (error instanceof LedgerDeviceNotFoundError) return 'device_not_found'
    if (error instanceof LedgerDeviceBusyError) return 'device_busy'
    if (error instanceof LedgerUsbNoDeviceError) return 'usb_no_device'
    if (error instanceof LedgerUsbMultipleDevicesError)
        return 'usb_multiple_devices'
    if (error instanceof LedgerNoAccountsFoundError) return 'no_accounts_found'
    if (error instanceof LedgerLocationServicesDisabledError)
        return 'location_services_disabled'
    if (error instanceof LedgerProviderNotFoundError)
        return 'provider_unavailable'
    if (error instanceof LedgerConnectionError) return 'connection_failed'
    return 'connection_failed'
}
