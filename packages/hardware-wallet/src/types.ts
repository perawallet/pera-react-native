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
 * App version reported by a hardware wallet device application.
 */
export type HardwareWalletAppVersion = {
    major: number
    minor: number
    patch: number
}

/**
 * Arbitrary-data signing request forwarded to the device. Kept manufacturer-
 * and standard-agnostic so this package does not depend on the signing
 * package's ARC-60 types. The signing strategy maps an ARC-60 request onto
 * this shape; the transport derives the BIP-44 path from `accountIndex`.
 */
export type HardwareWalletArbitrarySignRequest = {
    /** Sequential index on the device (0, 1, 2...) — authoritative for the key. */
    accountIndex: number
    /** Encoded payload to sign (e.g. base64 string). */
    data: string
    /** 32-byte Ed25519 public key of the signer (informational to the device). */
    signerPublicKey: Uint8Array
    /** Origin requesting the signature. */
    domain: string
    /** Authenticator data; first 32 bytes = sha256(domain). */
    authenticatorData: Uint8Array
    /** Optional unique request id. */
    requestId?: string
    /** ARC-60 scope (1 = AUTH). */
    scope: number
    /** Encoding of `data`. Currently only 'base64' is supported by the Algorand app. */
    encoding: string
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
 * Bluetooth adapter (radio) state, independent of any specific device.
 * Mirrors the platform BLE manager states (CoreBluetooth `CBManagerState`
 * on iOS, `BluetoothAdapter`/ble-plx `State` on Android) so the UI can warn
 * proactively when Bluetooth is unusable — e.g. show "Bluetooth is off"
 * before a scan silently finds nothing.
 *
 * - `poweredOn`    — ready to scan/connect
 * - `poweredOff`   — Bluetooth is turned off
 * - `unauthorized` — the app lacks Bluetooth permission (iOS)
 * - `unsupported`  — the device has no BLE hardware
 * - `resetting`    — the adapter is transitioning (transient)
 * - `unknown`      — not yet determined (transient, during init)
 */
export type HardwareWalletAdapterState =
    | 'poweredOn'
    | 'poweredOff'
    | 'unauthorized'
    | 'unsupported'
    | 'resetting'
    | 'unknown'

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

    /**
     * Sign arbitrary data on the device (ARC-60 AUTH scope). The user must
     * physically confirm on the device. The device computes the signing
     * payload itself from the provided fields.
     * @returns Ed25519 signature bytes
     */
    signData: (
        request: HardwareWalletArbitrarySignRequest,
    ) => Promise<Uint8Array>

    /** Read the version of the device's wallet application. */
    getAppVersion: () => Promise<HardwareWalletAppVersion>

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
     * @param deviceId - The device identifier from a previous scan.
     *   Note: on transports where IDs are not stable handles (e.g.
     *   Android USB host, where descriptors are reassigned on replug
     *   and lost on app restart), implementations may treat this as
     *   advisory and connect to the currently attached device.
     */
    connect: (deviceId: string) => Promise<HardwareWalletTransport>

    /** Check if this transport type is supported on the current platform. */
    isSupported: () => Promise<boolean>

    /**
     * Observe the Bluetooth adapter state (radio on/off, permission, etc.).
     * Emits the current state immediately on subscribe, then on every change.
     * Only meaningful for radio-based transports (BLE); transports without a
     * radio (e.g. USB) leave this undefined.
     *
     * @param onChange - Called with the current adapter state and on changes
     * @returns An unsubscribe function
     */
    observeBluetoothState?: (
        onChange: (state: HardwareWalletAdapterState) => void,
    ) => () => void

    /**
     * Surface the OS-level "turn on Bluetooth" prompt (iOS CoreBluetooth power
     * alert / Android system enable dialog). iOS can only inform + deep-link to
     * Settings; Android can actually enable the radio on consent.
     * Only meaningful for radio-based transports (BLE).
     *
     * @returns Resolves `true` when Bluetooth ends up enabled (Android) or the
     *   prompt was surfaced (iOS); `false` when unavailable or declined.
     */
    requestBluetoothEnable?: () => Promise<boolean>
}
