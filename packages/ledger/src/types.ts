/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Supported Ledger device models with Bluetooth capability.
 */
export type LedgerDeviceModel = 'nanoX' | 'stax' | 'flex'

/**
 * A discovered Ledger device during BLE scanning.
 */
export type LedgerDevice = {
    /** Platform-specific BLE device identifier */
    id: string
    /** User-visible device name (e.g. "Ledger Nano X") */
    name: string
    /** Detected device model based on BLE service UUID */
    model: LedgerDeviceModel
    /** Signal strength in dBm, or null if unavailable */
    rssi: number | null
}

/**
 * An Algorand account derived from a Ledger device.
 */
export type LedgerAccount = {
    /** Algorand address derived from the public key */
    address: string
    /** Raw 32-byte Ed25519 public key */
    publicKey: Uint8Array
    /** Sequential index on the Ledger device (0, 1, 2...) */
    accountIndex: number
}

/**
 * Connection lifecycle states for UI feedback.
 */
export type LedgerConnectionStatus =
    | 'disconnected'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'app_not_open'
    | 'ready'

/**
 * Platform-agnostic transport interface for communicating with a connected Ledger device.
 * Implemented by platform-specific extensions (e.g. BLE transport in React Native).
 */
export type LedgerTransport = {
    /**
     * Fetch the Algorand address at the given account index.
     * @param accountIndex - Sequential index on the device (0, 1, 2...)
     * @param verify - If true, display the address on the device for user verification
     */
    getAddress: (
        accountIndex: number,
        verify?: boolean,
    ) => Promise<LedgerAccount>

    /**
     * Sign a raw transaction on the Ledger device.
     * The user must physically confirm on the device.
     * @param accountIndex - Index of the signing key on the device
     * @param txnBytes - Raw unsigned transaction bytes (msgpack-encoded)
     * @returns Ed25519 signature bytes
     */
    signTransaction: (
        accountIndex: number,
        txnBytes: Uint8Array,
    ) => Promise<Uint8Array>

    /** Disconnect from the device and release BLE resources. */
    disconnect: () => Promise<void>
}

/**
 * Platform-agnostic provider for scanning and connecting to Ledger devices.
 * Implemented by platform-specific extensions.
 */
export type LedgerTransportProvider = {
    /**
     * Start scanning for Ledger devices via BLE.
     * @param onDevice - Called each time a new device is discovered
     * @returns A stop function to cancel the scan
     */
    scan: (onDevice: (device: LedgerDevice) => void) => () => void

    /**
     * Connect to a specific Ledger device and open the Algorand app transport.
     * @param deviceId - The BLE device identifier from a previous scan
     */
    connect: (deviceId: string) => Promise<LedgerTransport>

    /** Check if BLE transport is supported on this platform. */
    isSupported: () => Promise<boolean>
}
