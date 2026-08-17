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
import type { LedgerErrorActionKind } from '../utils/ledgerErrorPresets'
import { useBlePermissions } from './useBlePermissions'
import { useBluetoothState } from './useBluetoothState'

type UseLedgerErrorActionResult = {
    runAction: (kind: LedgerErrorActionKind) => void
}

/**
 * Executes the OS-level shortcut a Ledger error preset asks for.
 *
 * Bluetooth is the asymmetric one: Android can turn the radio on from a system
 * dialog without leaving Pera, while iOS has no such API and no public
 * Bluetooth settings URL — the app's own settings page (which carries its
 * Bluetooth permission toggle) is the closest sanctioned destination, so a
 * failed/absent enable prompt falls back to it on both platforms.
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
            void requestEnable().then(isPrompted => {
                if (!isPrompted) void openSettings()
            })
        },
        [requestEnable, openSettings, openLocationSettings],
    )

    return { runAction }
}
