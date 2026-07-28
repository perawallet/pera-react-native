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

import type { Network } from '@perawallet/wallet-core-shared'
import type { LegacyDeviceIdentifiers } from '@perawallet/wallet-extension-platform'

export const migrateDeviceIdentifiers = (
    identifiers: LegacyDeviceIdentifiers,
): void => {
    const device = useDeviceStore.getState()

    // This step is idempotent by necessity: a step-version bump replays it for
    // users who already migrated.
    //
    // Keying the "leave the live id alone" decision on id INEQUALITY would be
    // wrong, because a different non-null id has two very different causes:
    //   1. we already wrote the migrated id and registration's recreate-
    //      fallback replaced it after a 404 — retrying is pointless, and
    //   2. registration minted an id before this step ever ran, so the
    //      migrated id was never tried at all.
    // Case 2 is routine, not exotic: `pera_7_migration` defaults to false, so a
    // user outside a staged rollout registers first and migrates on a later
    // launch; dismissing a failed run un-gates the registrar the same way.
    // Treating case 2 like case 1 would discard a live migrated id — and its
    // device-keyed server state, e.g. Discover favourites — permanently,
    // causing the orphaning this ticket exists to measure.
    //
    // The origin flag distinguishes them: only skip when we know a migrated id
    // was already replaced. Otherwise write it and let the next PUT either
    // resolve (favourites restored) or 404 into recreate — no worse off than
    // not trying, and the 404 path reports the loss via telemetry.
    const applyMigratedDeviceId = (network: Network, migratedId: string) => {
        const currentId = device.deviceIDs.get(network)
        const origin = device.deviceIdOrigins[network]
        if (currentId != null && currentId !== migratedId) {
            if (origin === 'recreated') {
                return
            }
            if (origin === 'migrated') {
                device.setDeviceIdOrigin(network, 'recreated')
                return
            }
        }
        device.setDeviceID(network, migratedId)
        device.setDeviceIdOrigin(network, 'migrated')
    }

    const mainnetDeviceId =
        identifiers.mainnetDeviceId ?? identifiers.legacyFallbackDeviceId
    if (mainnetDeviceId) {
        applyMigratedDeviceId(Networks.mainnet, mainnetDeviceId)
    }
    // legacyFallbackDeviceId deliberately does NOT fall back to testnet.
    // Device ids are primary keys of a per-network backend deployment
    // (mainnet and testnet APIs have separate databases), and Pera 6's own
    // DeviceIdMigrationUseCase promoted the single legacy id to exactly one
    // network's record. Reusing the mainnet-registered id as the testnet id
    // would PUT an id the testnet backend never minted: at best a guaranteed
    // 404 → recreate (a false "migrated id replaced" signal), at worst a
    // collision with an unrelated device's testnet record.
    if (identifiers.testnetDeviceId) {
        applyMigratedDeviceId(Networks.testnet, identifiers.testnetDeviceId)
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
