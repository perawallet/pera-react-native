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

// Ledger types, errors, and protocol constants live in the Ledger
// extension (platform implementation of the hardware-wallet interface).
// Re-exported here so callers that depend on the business-logic package
// get the full Ledger surface from a single `@perawallet/wallet-core-ledger`
// import. `RNLedgerService` / `WithLedgerExtension` / `name` are extension
// internals and stay out of this barrel.
export type {
    LedgerDeviceModel,
    LedgerDevice,
    LedgerAccount,
    LedgerConnectionStatus,
    LedgerTransport,
    LedgerTransportProvider,
} from '@perawallet/wallet-extension-ledger-shared'
export {
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
    ALGORAND_BIP44_PREFIX,
    LEDGER_BLE_SERVICE_UUIDS,
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    LEDGER_CONNECTION_TIMEOUT_MS,
    LEDGER_SCAN_TIMEOUT_MS,
    LEDGER_STATUS_CODES,
    MIN_ARBITRARY_SIGN_APP_VERSION,
    buildLedgerAccountPath,
    isAppVersionAtLeast,
    resolveDeviceModel,
} from '@perawallet/wallet-extension-ledger-shared'

export * from './discovery'
export * from './hooks'
