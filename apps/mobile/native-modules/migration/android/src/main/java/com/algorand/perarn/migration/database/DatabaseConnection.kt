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
package com.algorand.perarn.migration.database

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants

internal inline fun <T> Context.openLegacyDatabaseReadOnly(dbName: String,block: (SQLiteDatabase) -> T): T? {
    val file = getDatabasePath(dbName)
    if (!file.exists()) return null
    return try {
        SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { db -> block(db) }
    } catch (t: Throwable) {
        Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to read $dbName", t)
        null
    }
}

internal inline fun <T> openLegacyDatabaseReadOnly(
    coordinator: SchemaMigrationCoordinator,
    plan: MigrationPlan,
    block: (SQLiteDatabase) -> T,
): T? {
    val path = coordinator.resolve(plan).readPath ?: return null
    return try {
        SQLiteDatabase.openDatabase(path, null, SQLiteDatabase.OPEN_READONLY).use { db -> block(db) }
    } catch (t: Throwable) {
        Log.w(LegacyMigrationConstants.LOG_TAG, "Failed to read ${plan.dbName} at $path", t)
        null
    }
}

internal fun Cursor.optString(column: String): String? {
    val idx = getColumnIndex(column)
    if (idx < 0 || isNull(idx)) return null
    return getString(idx).takeIf { it.isNotEmpty() }
}

internal fun Cursor.optInt(column: String): Int? {
    val idx = getColumnIndex(column)
    if (idx < 0 || isNull(idx)) return null
    return getInt(idx)
}

internal fun Cursor.optLong(column: String): Long? {
    val idx = getColumnIndex(column)
    if (idx < 0 || isNull(idx)) return null
    return getLong(idx)
}

internal fun Cursor.optBlob(column: String): ByteArray? {
    val idx = getColumnIndex(column)
    if (idx < 0 || isNull(idx)) return null
    return getBlob(idx)
}
