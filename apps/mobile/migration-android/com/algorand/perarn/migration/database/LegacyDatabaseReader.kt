/*
 * Copyright 2022-2025 Pera Wallet, LDA
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
package com.algorand.perarn.migration.database

import android.content.Context
import com.algorand.perarn.migration.encryption.AesKeystoreDecryptor

internal class LegacyDatabaseReader(context: Context) {
    private val decryptor = AesKeystoreDecryptor()
    private val coordinator = SchemaMigrationCoordinator(context)

    val accounts = AccountsReader(coordinator, decryptor)
    val contacts = ContactsReader(coordinator)
    val notifications = NotificationsReader(coordinator)
    val walletConnect = WalletConnectReader(context, coordinator)
    val passkeys = PasskeysReader(context)
    val customInfo = CustomInfoReader(coordinator)

    fun replayResults(): Map<String, ReplayResult> = coordinator.snapshot()

    fun cleanupCacheCopies() {
        coordinator.cleanup()
    }
}
