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

import { Networks } from '@perawallet/wallet-core-config'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import type { LegacyDeviceIdentifiers } from '@perawallet/wallet-extension-platform'

export const migrateDeviceIdentifiers = (
    identifiers: LegacyDeviceIdentifiers,
): void => {
    const device = useDeviceStore.getState()
    const mainnetDeviceId =
        identifiers.mainnetDeviceId ?? identifiers.legacyFallbackDeviceId
    if (mainnetDeviceId) {
        device.setDeviceID(Networks.mainnet, mainnetDeviceId)
    }
    if (identifiers.testnetDeviceId) {
        device.setDeviceID(Networks.testnet, identifiers.testnetDeviceId)
    }

    const settings = useSettingsStore.getState()
    if (identifiers.notificationUserId) {
        settings.setPreference(
            'legacy.device.notificationUserId',
            identifiers.notificationUserId,
        )
    }
    if (identifiers.lastSeenNotificationId !== null) {
        settings.setPreference(
            'legacy.device.lastSeenNotificationId',
            identifiers.lastSeenNotificationId,
        )
    }
}
