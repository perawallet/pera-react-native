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

import { useCallback, useEffect, useState } from 'react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { HardwareWalletAdapterState } from '@perawallet/wallet-core-hardware-wallet'

/**
 * Adapter states that represent an actionable problem the user can resolve
 * (turn Bluetooth on, grant permission). Transient states (`unknown`,
 * `resetting`) are excluded so we don't flash a warning during init.
 */
const UNAVAILABLE_STATES: HardwareWalletAdapterState[] = [
    'poweredOff',
    'unauthorized',
    'unsupported',
]

type UseBluetoothStateResult = {
    /** Current Bluetooth adapter state. `unknown` until the first emission. */
    adapterState: HardwareWalletAdapterState
    /** True when the adapter is powered on and ready to scan/connect. */
    isBluetoothReady: boolean
    /** True for a definitive, actionable problem (off / unauthorized / unsupported). */
    isBluetoothUnavailable: boolean
    /**
     * Surface the OS "turn on Bluetooth" prompt (iOS power alert / Android
     * enable dialog). No-op resolving `false` when no BLE provider supports it.
     */
    requestEnable: () => Promise<boolean>
}

const getBleProvider = () =>
    getProvider().hardwareWalletRegistry.getProvider('ledger', 'ble')

/**
 * Observes the Bluetooth adapter state via the registered Ledger BLE provider.
 *
 * This is the React Native equivalent of iOS's `CBCentralManagerDelegate`
 * state observation: it lets a screen react proactively when Bluetooth is
 * off (or unauthorized) instead of silently finding no devices.
 *
 * Returns `unknown`/not-ready when no BLE provider is registered (e.g. a
 * platform without the Ledger BLE extension), so callers degrade gracefully.
 */
export const useBluetoothState = (): UseBluetoothStateResult => {
    const [adapterState, setAdapterState] =
        useState<HardwareWalletAdapterState>('unknown')

    useEffect(() => {
        const provider = getBleProvider()
        if (!provider?.observeBluetoothState) return undefined
        return provider.observeBluetoothState(setAdapterState)
    }, [])

    const requestEnable = useCallback(async (): Promise<boolean> => {
        const provider = getBleProvider()
        if (!provider?.requestBluetoothEnable) return false
        return provider.requestBluetoothEnable()
    }, [])

    return {
        adapterState,
        isBluetoothReady: adapterState === 'poweredOn',
        isBluetoothUnavailable: UNAVAILABLE_STATES.includes(adapterState),
        requestEnable,
    }
}
