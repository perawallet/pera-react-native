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

import {
    BIOMETRIC_BLOB_KEY_ID,
    BIOMETRIC_TOKEN_HASH_METADATA_KEY,
    createPinRecord,
    encodeBiometricBlob,
    PIN_RECORD_KEY_ID,
    serializePinRecord,
} from '@perawallet/wallet-core-security'
import { commitSecret, withSecret } from '@perawallet/wallet-core-kms'
import { getProvider } from '@perawallet/wallet-extension-provider'
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
            // No user is present to complete a ceremony, and arming needs none.
            // A key that turns out unusable is dropped by the next reconcile or,
            // after repeated failed unwraps, by the unlock path, and the user is
            // asked to opt in again.
            const armed = await getProvider().biometrics.armBiometricBinding()
            if (armed) {
                await commitSecret({
                    id: BIOMETRIC_BLOB_KEY_ID,
                    bytes: encodeBiometricBlob(armed.blob),
                    metadata: {
                        [BIOMETRIC_TOKEN_HASH_METADATA_KEY]: armed.tokenHash,
                    },
                })
                result.biometricMigrated = true
            }
        }
    } finally {
        pinBytes.fill(0)
    }

    return result
}
