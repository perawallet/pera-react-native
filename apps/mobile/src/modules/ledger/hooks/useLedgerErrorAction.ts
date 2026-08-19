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

import { useCallback } from 'react'
import { Platform } from 'react-native'
import type { LedgerErrorActionKind } from '../utils/ledgerErrorPresets'
import { useBlePermissions } from './useBlePermissions'
import { useBluetoothState } from './useBluetoothState'

type UseLedgerErrorActionResult = {
    runAction: (kind: LedgerErrorActionKind) => void
}

/**
 * Executes the OS-level shortcut a Ledger error preset asks for.
 *
 * Bluetooth is the asymmetric one. Android's `requestEnable` shows a real
 * system dialog and reports whether it appeared, so the user never leaves
 * Pera. iOS cannot toggle the radio at all: its `requestEnable` only asks
 * CoreBluetooth to present the system power alert and returns `true`
 * unconditionally because it has no way to know whether anything was shown —
 * and that alert is suppressed once it has been shown, or when a central
 * manager already exists (which the signing pre-flight has just created).
 * Keying the fallback on that return value therefore left the button doing
 * nothing at all, so iOS goes straight to Pera's settings page — the only
 * destination guaranteed to be visible, and the closest sanctioned one, since
 * there is no public URL for the Bluetooth pane.
 */
export const useLedgerErrorAction = (): UseLedgerErrorActionResult => {
    const { requestEnable } = useBluetoothState()
    const { openSettings, openLocationSettings } = useBlePermissions()

    const runAction = useCallback(
        (kind: LedgerErrorActionKind) => {
            if (kind === 'location') {
                void openLocationSettings()
                return
            }
            if (kind === 'app_settings') {
                void openSettings()
                return
            }
            if (Platform.OS !== 'android') {
                void openSettings()
                return
            }
            void requestEnable().then(isPrompted => {
                if (!isPrompted) void openSettings()
            })
        },
        [requestEnable, openSettings, openLocationSettings],
    )

    return { runAction }
}
