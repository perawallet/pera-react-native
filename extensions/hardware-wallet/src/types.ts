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

/** Known values get autocomplete; arbitrary strings allow future brands. */
export type HardwareWalletManufacturer = 'ledger' | (string & {})

/** 'ble' (Bluetooth) or 'usb' (Android USB host / HID). */
export type LedgerTransportType = 'ble' | 'usb'

export type HardwareWalletDevice = {
    /** Platform-specific. */
    id: string
    /** User-visible, e.g. "Ledger Nano X". */
    name: string
    manufacturer: HardwareWalletManufacturer
    transportType: LedgerTransportType
    /** Manufacturer-specific, e.g. "nanoX", "stax". */
    model: string
    /** Signal strength in dBm; null when unavailable. */
    rssi: Nullable<number>
}

export type HardwareWalletDerivedAccount = {
    address: string
    /** Raw 32-byte Ed25519 public key. */
    publicKey: Uint8Array
    /** Sequential index on the device (0, 1, 2...). */
    accountIndex: number
}

export type HardwareWalletAppVersion = {
    major: number
    minor: number
    patch: number
}

/**
 * Kept manufacturer- and standard-agnostic so this package doesn't depend on
 * the signing package's ARC-60 types.
 */
export type HardwareWalletArbitrarySignRequest = {
    /** Authoritative for the key — the transport derives the BIP-44 path here. */
    accountIndex: number
    /** Encoded payload to sign. */
    data: string
    /** Informational to the device. */
    signerPublicKey: Uint8Array
    /** Origin requesting the signature. */
    domain: string
    /** First 32 bytes = sha256(domain). */
    authenticatorData: Uint8Array
    requestId?: string
    /** ARC-60 scope (1 = AUTH). */
    scope: number
    /** The Algorand app only supports 'base64'. */
    encoding: string
}

export type HardwareWalletConnectionStatus =
    | 'disconnected'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'app_not_open'
    | 'ready'

/**
 * Radio state, independent of any device. Mirrors the platform BLE manager
 * states (iOS `CBManagerState`, Android ble-plx `State`) so the UI can warn
 * before a scan silently finds nothing. `resetting` and `unknown` are
 * transient.
 */
export type HardwareWalletAdapterState =
    | 'poweredOn'
    | 'poweredOff'
    | 'unauthorized'
    | 'unsupported'
    | 'resetting'
    | 'unknown'

/** Implemented by manufacturer-specific extensions (e.g. Ledger BLE). */
export type HardwareWalletTransport = {
    /** `verify` displays the address on the device for the user to confirm. */
    getAddress: (
        accountIndex: number,
        verify?: boolean,
    ) => Promise<HardwareWalletDerivedAccount>

    /**
     * Blocks on physical confirmation. `txnBytes` is msgpack-encoded; resolves
     * to the Ed25519 signature.
     */
    signTransaction: (
        accountIndex: number,
        txnBytes: Uint8Array,
    ) => Promise<Uint8Array>

    /**
     * ARC-60 AUTH scope. Blocks on physical confirmation; the device computes
     * the signing payload itself from the request fields.
     */
    signData: (
        request: HardwareWalletArbitrarySignRequest,
    ) => Promise<Uint8Array>

    getAppVersion: () => Promise<HardwareWalletAppVersion>

    /**
     * Fires when the link drops from the device's side. A pending APDU promise
     * does NOT reject on disconnect — it hangs until its timeout — so callers
     * waiting on a confirmation need this to fail fast instead of sitting on
     * the multi-minute ceiling.
     *
     * Absent when the underlying transport exposes no disconnect event, so
     * callers must degrade to their timeout. Returns an unsubscribe function.
     */
    onDisconnect?: (listener: () => void) => () => void

    disconnect: () => Promise<void>
}

/** Each (manufacturer, transportType) pair registers exactly one provider. */
export type HardwareWalletTransportProvider = {
    manufacturer: HardwareWalletManufacturer

    transportType: LedgerTransportType

    /** Returns a stop function. */
    scan: (
        onDevice: (device: HardwareWalletDevice) => void,
        onError?: (error: Error) => void,
    ) => () => void

    /**
     * `deviceId` comes from a previous scan, but is advisory where IDs aren't
     * stable handles (Android USB reassigns descriptors on replug and loses
     * them on app restart) — those implementations connect to whatever is
     * currently attached.
     */
    connect: (deviceId: string) => Promise<HardwareWalletTransport>

    /** Check if this transport type is supported on the current platform. */
    isSupported: () => Promise<boolean>

    /**
     * Emits immediately on subscribe, then on every change; returns an
     * unsubscribe. Radio-based transports only — USB leaves this undefined.
     */
    observeBluetoothState?: (
        onChange: (state: HardwareWalletAdapterState) => void,
    ) => () => void

    /**
     * Surfaces the OS "turn on Bluetooth" prompt. Android can actually enable
     * the radio on consent; iOS can only inform and deep-link to Settings, so
     * `true` there means only that the prompt was surfaced.
     */
    requestBluetoothEnable?: () => Promise<boolean>
}
