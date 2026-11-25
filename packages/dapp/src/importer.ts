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

export const LEGACY_DAPP_PERMISSIONS_KEY = 'pera-dapp-permissions'

/** The `chrome.storage.local` subset needed to remove old dApp permissions. */
export type LegacyDappPermissionArea = {
    get(key: string): Promise<Record<string, unknown>>
    remove(key: string): Promise<void>
}

/**
 * A leftover blob may already have been migrated and contain revoked grants.
 * Remove it so dApps without a current grant use the normal approval flow.
 */
export const clearLegacyDappPermissions = async (
    area: LegacyDappPermissionArea,
): Promise<void> => {
    const entries = await area.get(LEGACY_DAPP_PERMISSIONS_KEY)
    if (LEGACY_DAPP_PERMISSIONS_KEY in entries) {
        await area.remove(LEGACY_DAPP_PERMISSIONS_KEY)
    }
}
