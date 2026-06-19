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

internal data class ContactRow(
    val name: String,
    val address: String,
    val avatar: String?,
)

internal class ContactsReader(
    private val coordinator: SchemaMigrationCoordinator,
) {

    fun readContacts(): List<ContactRow> =
        openLegacyDatabaseReadOnly(coordinator, AlgorandDbMigrations.PLAN) { db ->
            val rows = ArrayList<ContactRow>()
            db.rawQuery("SELECT name, public_key, uri FROM User", null).use { c ->
                while (c.moveToNext()) {
                    val name = c.optString("name") ?: continue
                    val address = c.optString("public_key") ?: continue
                    rows += ContactRow(
                        name = name,
                        address = address,
                        avatar = normalizeContactAvatarUri(c.optString("uri")),
                    )
                }
            }
            rows
        }.orEmpty()

    // Legacy MediaStore/PhotoPicker URIs lack persistable permission and die with the legacy process; drop them to avoid SecurityException.
    private fun normalizeContactAvatarUri(raw: String?): String? = when {
        raw == null -> null
        raw.startsWith("content://media/") -> null
        raw.startsWith("content://com.android.providers.media") -> null
        else -> raw
    }
}
