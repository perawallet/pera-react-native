/*
 * Copyright 2022-2026 Pera Wallet, LDA
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
package com.algorand.perarn.migration.fixtures

internal object FixtureIdentities {

    const val HD_KEY_0_ADDRESS = FixtureCrypto.HD_KEY_0_ADDRESS
    const val HD_KEY_1_ADDRESS = FixtureCrypto.HD_KEY_1_ADDRESS
    const val HD_KEY_2_ADDRESS = FixtureCrypto.HD_KEY_2_ADDRESS

    const val ALGO25_VALID_ADDRESS = FixtureCrypto.ALGO25_VALID_ADDRESS

    val STANDARD_NO_KEY_ADDRESS = "STANDARDNOKEYACCOUNT" + "A".repeat(38)

    const val WATCH_ONLY_1_ADDRESS = FixtureCrypto.WATCH_1_ADDRESS
    const val WATCH_ONLY_2_ADDRESS = FixtureCrypto.WATCH_2_ADDRESS

    const val LEDGER_VALID_1_ADDRESS = FixtureCrypto.LEDGER_1_ADDRESS
    const val LEDGER_VALID_2_ADDRESS = FixtureCrypto.LEDGER_2_ADDRESS

    const val EXTERNAL_PARTICIPANT_ADDRESS = FixtureCrypto.EXTERNAL_PARTICIPANT_ADDRESS

    const val SEED_1_ID = 1

    const val MAINNET_DEVICE_ID = "android-sim-mainnet-device-id"
    const val TESTNET_DEVICE_ID = "android-sim-testnet-device-id"
    const val NOTIFICATION_USER_ID = "android-sim-notification-user-id"
}
