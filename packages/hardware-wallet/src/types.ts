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
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Identifies the hardware wallet manufacturer.
 * Known values get autocomplete; arbitrary strings are allowed for future brands.
 */
export type HardwareWalletManufacturer = 'ledger' | (string & {})

/**
 * Identifies the wire transport used to reach a hardware wallet device.
 * Currently 'ble' (Bluetooth) and 'usb' (Android USB host / HID).
 */
export type LedgerTransportType = 'ble' | 'usb'

/**
 * A discovered hardware wallet device during scanning.
 */
export type HardwareWalletDevice = {
    /** Platform-specific device identifier */
    id: string
    /** User-visible device name (e.g. "Ledger Nano X") */
    name: string
    /** The manufacturer of this device */
    manufacturer: HardwareWalletManufacturer
    /** The transport this device was discovered on */
    transportType: LedgerTransportType
    /** Device model identifier (manufacturer-specific, e.g. "nanoX", "stax") */
    model: string
    /** Signal strength in dBm, or null if unavailable */
    rssi: Nullable<number>
}

/**
 * An Algorand account derived from a hardware wallet device.
 */
export type HardwareWalletDerivedAccount = {
    /** Algorand address derived from the public key */
    address: string
    /** Raw 32-byte Ed25519 public key */
    publicKey: Uint8Array
    /** Sequential index on the device (0, 1, 2...) */
    accountIndex: number
}

/**
 * Connection lifecycle states for UI feedback.
 */
export type HardwareWalletConnectionStatus =
    | 'disconnected'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'app_not_open'
    | 'ready'

/**
 * Platform-agnostic transport interface for communicating with a connected hardware wallet.
 * Implemented by manufacturer-specific extensions (e.g. Ledger BLE transport).
 */
export type HardwareWalletTransport = {
    /**
     * Fetch the Algorand address at the given account index.
     * @param accountIndex - Sequential index on the device (0, 1, 2...)
     * @param verify - If true, display the address on the device for user verification
     */
    getAddress: (
        accountIndex: number,
        verify?: boolean,
    ) => Promise<HardwareWalletDerivedAccount>

    /**
     * Sign a raw transaction on the hardware wallet device.
     * The user must physically confirm on the device.
     * @param accountIndex - Index of the signing key on the device
     * @param txnBytes - Raw unsigned transaction bytes (msgpack-encoded)
     * @returns Ed25519 signature bytes
     */
    signTransaction: (
        accountIndex: number,
        txnBytes: Uint8Array,
    ) => Promise<Uint8Array>

    /** Disconnect from the device and release resources. */
    disconnect: () => Promise<void>
}

/**
 * Platform-agnostic provider for scanning and connecting to hardware wallet devices.
 * Each (manufacturer, transportType) pair registers exactly one provider.
 */
export type HardwareWalletTransportProvider = {
    /** Identifies which manufacturer this provider serves */
    manufacturer: HardwareWalletManufacturer

    /** Identifies which wire transport this provider implements */
    transportType: LedgerTransportType

    /**
     * Start scanning for devices.
     * @param onDevice - Called each time a new device is discovered
     * @param onError - Called when a scan error occurs (e.g. Bluetooth disabled)
     * @returns A stop function to cancel the scan
     */
    scan: (
        onDevice: (device: HardwareWalletDevice) => void,
        onError?: (error: Error) => void,
    ) => () => void

    /**
     * Connect to a specific device and open the transport.
     * @param deviceId - The device identifier from a previous scan
     */
    connect: (deviceId: string) => Promise<HardwareWalletTransport>

    /** Check if this transport type is supported on the current platform. */
    isSupported: () => Promise<boolean>
}
