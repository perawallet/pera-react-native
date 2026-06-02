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
package com.algorand.perarn.migration.fixtures

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.algorand.perarn.migration.bridge.LegacyMigrationConstants
import com.algorand.perarn.migration.database.AddressDbMigrations
import com.algorand.perarn.migration.database.AlgorandDbMigrations
import com.algorand.perarn.migration.database.MigrationPlan
import com.algorand.perarn.migration.database.PeraDbMigrations
import com.algorand.perarn.migration.encryption.AesKeystoreEncryptor
import java.io.File

internal object MigrationSimulator {

    fun generate(
        context: Context,
        dbName: String,
        version: Int,
        includeUnroutable: Boolean,
        includeAuthState: Boolean,
    ) {
        val plan = planFor(dbName)
        require(version in plan.oldestSupported..plan.targetVersion) {
            "version $version out of range [${plan.oldestSupported}, ${plan.targetVersion}] for $dbName"
        }

        FixturesSharedPrefs.applyAuthState(context, includeAuthState)

        deleteDatabaseFiles(context, dbName)

        val target = context.getDatabasePath(dbName)
        target.parentFile?.mkdirs()

        val encryptor = AesKeystoreEncryptor()
        val db = SQLiteDatabase.openOrCreateDatabase(target, null)
        try {
            db.beginTransaction()
            try {
                for (stmt in buildSchemaAtVersion(plan, version)) {
                    db.execSQL(stmt)
                }
                insertFixtures(db, dbName, version, encryptor, includeUnroutable)
                db.execSQL("PRAGMA user_version = $version")
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        } catch (t: Throwable) {
            db.close()
            deleteDatabaseFiles(context, dbName)
            throw t
        }
        db.close()
    }

    fun generatePreSixxAccounts(context: Context) {
        FixturesPreSixxAccounts.apply(context)
    }

    private fun planFor(dbName: String): MigrationPlan = when (dbName) {
        LegacyMigrationConstants.ADDRESS_DB_NAME -> AddressDbMigrations.PLAN
        LegacyMigrationConstants.PERA_DB_NAME -> PeraDbMigrations.PLAN
        LegacyMigrationConstants.ALGORAND_DB_NAME -> AlgorandDbMigrations.PLAN
        else -> throw IllegalArgumentException("No simulator plan for $dbName")
    }

    private fun insertFixtures(
        db: SQLiteDatabase,
        dbName: String,
        version: Int,
        encryptor: AesKeystoreEncryptor,
        includeUnroutable: Boolean,
    ) {
        when (dbName) {
            LegacyMigrationConstants.ADDRESS_DB_NAME ->
                FixturesAddressDb.insert(db, version, encryptor, includeUnroutable)
            LegacyMigrationConstants.PERA_DB_NAME ->
                FixturesPeraDb.insert(db, version)
            LegacyMigrationConstants.ALGORAND_DB_NAME ->
                FixturesAlgorandDb.insert(db, version)
        }
    }

    private fun deleteDatabaseFiles(context: Context, dbName: String) {
        val main = context.getDatabasePath(dbName)
        main.delete()
        File(main.parentFile, main.name + "-wal").delete()
        File(main.parentFile, main.name + "-shm").delete()
        File(main.parentFile, main.name + "-journal").delete()
    }
}
