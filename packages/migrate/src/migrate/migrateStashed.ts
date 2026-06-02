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

import { useSettingsStore } from '@perawallet/wallet-core-settings'
import type { LegacyPasskey } from '@perawallet/wallet-extension-platform'

export type StashedMigrationResult = {
    passkeysStashed: number
}

export const migrateStashed = (args: {
    passkeys: LegacyPasskey[]
    walletConnectHistoryBlob?: string | null
}): StashedMigrationResult => {
    const settings = useSettingsStore.getState()
    const result: StashedMigrationResult = { passkeysStashed: 0 }

    if (args.passkeys.length > 0) {
        settings.setPreference('legacy.passkeys', JSON.stringify(args.passkeys))
        result.passkeysStashed = args.passkeys.length
    }

    if (args.walletConnectHistoryBlob != null) {
        settings.setPreference(
            'legacy.walletConnectHistoryBlob',
            args.walletConnectHistoryBlob,
        )
    }

    return result
}
