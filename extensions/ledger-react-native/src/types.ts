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

import type {
    HardwareWalletConnectionStatus,
    HardwareWalletDerivedAccount,
    HardwareWalletDevice,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'

/**
 * Supported Ledger device models with Bluetooth capability.
 */
export type LedgerDeviceModel = 'nanoX' | 'stax' | 'flex' | 'nanoGen5'

/**
 * A discovered Ledger device during BLE scanning.
 * Extends the generic hardware wallet device with a Ledger-specific model type.
 */
export type LedgerDevice = HardwareWalletDevice & {
    model: LedgerDeviceModel
}

/**
 * An Algorand account derived from a Ledger device.
 * Alias for the generic hardware wallet derived account.
 */
export type LedgerAccount = HardwareWalletDerivedAccount

/**
 * Connection lifecycle states for Ledger UI feedback.
 * Alias for the generic hardware wallet connection status.
 */
export type LedgerConnectionStatus = HardwareWalletConnectionStatus

/**
 * Platform-agnostic transport interface for communicating with a connected Ledger device.
 * Alias for the generic hardware wallet transport.
 */
export type LedgerTransport = HardwareWalletTransport

/**
 * Platform-agnostic provider for scanning and connecting to Ledger devices.
 * Alias for the generic hardware wallet transport provider.
 */
export type LedgerTransportProvider = HardwareWalletTransportProvider
