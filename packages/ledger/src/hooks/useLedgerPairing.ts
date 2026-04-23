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

import { useCallback } from 'react'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLedgerPairingStore } from '../store/pairingStore'

export type UseLedgerPairingResult = {
    /** The device awaiting pairing-instructions confirmation, if any. */
    pendingPairingDevice: Nullable<HardwareWalletDevice>
    /**
     * Request to proceed with a device. If the device has been paired with
     * before, `onReady` is invoked immediately; otherwise the device is
     * parked in `pendingPairingDevice` so the UI can show the pairing sheet
     * and the caller decides how to proceed via `confirmPairing`.
     */
    requestPairing: (
        device: HardwareWalletDevice,
        onReady: (device: HardwareWalletDevice) => void,
    ) => void
    /**
     * Confirm the pairing instructions for the pending device, mark it as
     * paired, clear the pending state, and invoke `onReady`.
     */
    confirmPairing: (onReady: (device: HardwareWalletDevice) => void) => void
    /** Dismiss the pairing sheet without marking the device paired. */
    cancelPairing: () => void
}

/**
 * Business-logic hook that owns the Ledger first-connect pairing flow.
 * Wraps the pairing store so UI hooks only need to bind handlers to a
 * sheet, without knowing about pairedDeviceIds or the pending-device
 * state machine.
 */
export const useLedgerPairing = (): UseLedgerPairingResult => {
    const pendingPairingDevice = useLedgerPairingStore(
        state => state.pendingPairingDevice,
    )
    const isPaired = useLedgerPairingStore(state => state.isPaired)
    const markPaired = useLedgerPairingStore(state => state.markPaired)
    const setPendingPairingDevice = useLedgerPairingStore(
        state => state.setPendingPairingDevice,
    )

    const requestPairing = useCallback(
        (
            device: HardwareWalletDevice,
            onReady: (device: HardwareWalletDevice) => void,
        ) => {
            if (isPaired(device.id)) {
                onReady(device)
                return
            }
            setPendingPairingDevice(device)
        },
        [isPaired, setPendingPairingDevice],
    )

    const confirmPairing = useCallback(
        (onReady: (device: HardwareWalletDevice) => void) => {
            const device = useLedgerPairingStore.getState().pendingPairingDevice
            if (!device) return
            markPaired(device.id)
            setPendingPairingDevice(null)
            onReady(device)
        },
        [markPaired, setPendingPairingDevice],
    )

    const cancelPairing = useCallback(() => {
        setPendingPairingDevice(null)
    }, [setPendingPairingDevice])

    return {
        pendingPairingDevice,
        requestPairing,
        confirmPairing,
        cancelPairing,
    }
}
