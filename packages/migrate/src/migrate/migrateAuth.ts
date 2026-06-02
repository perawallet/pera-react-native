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

import {
    BIOMETRIC_BLOB_KEY_ID,
    createPinRecord,
    PIN_RECORD_KEY_ID,
    serializePinRecord,
} from '@perawallet/wallet-core-security'
import { commitSecret, withSecret } from '@perawallet/wallet-core-kms'
import type {
    LegacyAuth,
    LegacyPreferences,
} from '@perawallet/wallet-extension-platform'

export type AuthMigrationResult = {
    pinMigrated: boolean
    biometricMigrated: boolean
    lockoutMigrated: boolean
}

export const migrateAuth = async (
    auth: LegacyAuth,
    preferences: LegacyPreferences,
): Promise<AuthMigrationResult> => {
    const result: AuthMigrationResult = {
        pinMigrated: false,
        biometricMigrated: false,
        lockoutMigrated: false,
    }

    const pinBytes = auth.pin
    if (!pinBytes || pinBytes.length === 0) return result

    try {
        const hasExistingPin = await withSecret(PIN_RECORD_KEY_ID, () => true)
        if (hasExistingPin) return result

        const pinString = new TextDecoder().decode(pinBytes)
        const record = await createPinRecord(pinString)

        if (preferences.lockAttemptCount !== null) {
            record.failedAttempts = preferences.lockAttemptCount
            result.lockoutMigrated = true
        }
        if (
            preferences.lockPenaltyRemainingMs !== null &&
            preferences.lockPenaltyRemainingMs > 0
        ) {
            record.lockoutEndTime =
                Date.now() + preferences.lockPenaltyRemainingMs
            result.lockoutMigrated = true
        }

        await commitSecret({
            id: PIN_RECORD_KEY_ID,
            bytes: serializePinRecord(record),
        })
        result.pinMigrated = true

        if (preferences.biometricEnabled === true) {
            await commitSecret({ id: BIOMETRIC_BLOB_KEY_ID, bytes: pinBytes })
            result.biometricMigrated = true
        }
    } finally {
        pinBytes.fill(0)
    }

    return result
}
