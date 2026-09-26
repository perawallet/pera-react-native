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

// The transports throw these types, errors and constants, and an extension
// may not depend on a business package, so they live in the ledger-shared
// extension. This package is the facade over them (as kms is over the
// keystore) so the app and signing import Ledger from one place. The
// transport-only `resolveUsbDeviceModel` stays out of this barrel.
export type {
    LedgerDeviceModel,
    LedgerDevice,
    LedgerAccount,
    LedgerConnectionStatus,
    LedgerTransport,
    LedgerTransportProvider,
} from '@perawallet/wallet-extension-ledger-shared'
export {
    LedgerError,
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
    classifyLedgerError,
} from '@perawallet/wallet-extension-ledger-shared'
export {
    LEDGER_BLE_SERVICE_UUIDS,
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    LEDGER_CONNECTION_TIMEOUT_MS,
    LEDGER_SCAN_TIMEOUT_MS,
    LEDGER_STATUS_CODES,
    MIN_ARBITRARY_SIGN_APP_VERSION,
    isAppVersionAtLeast,
    resolveDeviceModel,
} from '@perawallet/wallet-extension-ledger-shared'

export * from './discovery'
export * from './hooks'
