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
package com.algorand.perarn.migration.builder

import android.content.Context
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.database.LegacyDatabaseReader
import com.algorand.perarn.migration.sharedprefs.SharedPrefsReader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

internal class LegacyDataBuilder(private val context: Context) {

    fun build(): WritableMap {
        val sharedPrefs = SharedPrefsReader(context)
        val prefsResult = sharedPrefs.read()
        val preSixxAccounts = sharedPrefs.accountsBlob.read()
        val dbReader = LegacyDatabaseReader(context)
        try {
            val hdSeeds = dbReader.accounts.readHdSeeds()
            val hdKeyRows = dbReader.accounts.readHdKeys()
            val hdKeysByAddress = hdKeyRows.associateBy { it.address }
            val hdKeysBySeed = hdKeyRows.groupBy { it.seedId }
            val algo25 = dbReader.accounts.readAlgo25().associateBy { it.address }
            val noAuth = dbReader.accounts.readNoAuthAddresses().toSet()
            val ledgerBle = dbReader.accounts.readLedgerBle().associateBy { it.address }
            val joints = dbReader.accounts.readJointAccounts()
            val customInfo = dbReader.customInfo.readAccountInfo()
            val customHdSeedInfo = dbReader.customInfo.readHdSeedInfo()
            val contacts = dbReader.contacts.readContacts()
            val notificationFilters = dbReader.notifications.readNotificationFilters()
            val wcV1 = dbReader.walletConnect.readV1Sessions()
            val wcV2 = dbReader.walletConnect.readV2Sessions()
            val passkeys = dbReader.passkeys.readPasskeys()

            val accountsArray = composeAccountsArray(
                hdKeys = hdKeysByAddress,
                algo25 = algo25,
                noAuth = noAuth,
                ledgerBle = ledgerBle,
                joints = joints,
                customInfo = customInfo,
                preSixxAccounts = preSixxAccounts,
            )

            val hdWalletsArray = composeHdWalletsArray(
                hdSeeds = hdSeeds,
                hdKeysBySeed = hdKeysBySeed,
                customHdSeedInfo = customHdSeedInfo,
            )

            val out = Arguments.createMap()
            out.putInt("schemaVersion", LegacyMigrationConstants.SCHEMA_VERSION)
            out.putString("sourcePlatform", "android")
            out.putMap("preferences", prefsResult.preferences)
            out.putMap("auth", prefsResult.auth)
            out.putArray("accounts", accountsArray)
            out.putArray("hdWallets", hdWalletsArray)
            out.putArray("contacts", contacts.toContactsArray())
            out.putArray("notificationFilters", notificationFilters.toNotificationFiltersArray())
            out.putArray("walletConnectV1", wcV1.toWalletConnectV1Array())
            out.putArray("walletConnectV2", wcV2.toWalletConnectV2Array())
            out.putArray("passkeys", passkeys.toPasskeysArray())
            out.putMap("deviceIdentifiers", prefsResult.deviceIdentifiers)
            out.putMap("tooltipPreferences", prefsResult.tooltips)
            out.putMap("dismissedBanners", prefsResult.dismissedBanners)
            out.putMap("schemaReplayResults", composeSchemaReplayResults(dbReader.replayResults()))
            return out
        } finally {
            dbReader.cleanupCacheCopies()
        }
    }
}
