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
import android.database.sqlite.SQLiteDatabase
import java.io.File

internal data class BundledMigration(
    val from: Int,
    val to: Int,
    val description: String,
    val sql: List<String>,
)

internal data class MigrationPlan(
    val dbName: String,
    val targetVersion: Int,
    val oldestSupported: Int,
    val readerImpact: String,
    val migrations: List<BundledMigration>,
)

internal sealed interface ReplayResult {
    val readPath: String?

    data class Missing(val dbName: String) : ReplayResult {
        override val readPath: String? = null
    }

    data class NotNeeded(val originalPath: String, val currentVersion: Int) : ReplayResult {
        override val readPath: String = originalPath
    }

    data class Ahead(val originalPath: String, val currentVersion: Int) : ReplayResult {
        override val readPath: String = originalPath
    }

    data class Replayed(
        val copyPath: String,
        val fromVersion: Int,
        val toVersion: Int,
    ) : ReplayResult {
        override val readPath: String = copyPath
    }

    data class TooOld(val currentVersion: Int, val oldestSupported: Int) : ReplayResult {
        override val readPath: String? = null
    }

    data class Failed(
        val cause: Throwable,
        val partialVersion: Int,
    ) : ReplayResult {
        override val readPath: String? = null
    }
}

internal object SchemaMigrationReplay {

    fun run(context: Context, plan: MigrationPlan): ReplayResult {
        val original = context.getDatabasePath(plan.dbName)
        if (!original.exists()) return ReplayResult.Missing(plan.dbName)

        val current = readUserVersion(original) ?: return ReplayResult.Failed(
            cause = IllegalStateException("Failed to read user_version from ${plan.dbName}"),
            partialVersion = -1,
        )

        if (current == plan.targetVersion) {
            return ReplayResult.NotNeeded(original.absolutePath, current)
        }
        if (current > plan.targetVersion) {
            return ReplayResult.Ahead(original.absolutePath, current)
        }
        if (current < plan.oldestSupported) {
            return ReplayResult.TooOld(current, plan.oldestSupported)
        }

        val steps = plan.migrations
            .filter { it.from >= current && it.to <= plan.targetVersion }
            .sortedBy { it.from }
        if (steps.isEmpty() || steps.first().from != current || steps.last().to != plan.targetVersion) {
            return ReplayResult.Failed(
                cause = IllegalStateException(
                    "${plan.dbName} has no contiguous migration path from $current to ${plan.targetVersion}",
                ),
                partialVersion = current,
            )
        }
        for (i in 0 until steps.lastIndex) {
            if (steps[i].to != steps[i + 1].from) {
                return ReplayResult.Failed(
                    cause = IllegalStateException(
                        "${plan.dbName} migration gap between ${steps[i].to} and ${steps[i + 1].from}",
                    ),
                    partialVersion = current,
                )
            }
        }

        val copy = stageCacheCopy(context, original) ?: return ReplayResult.Failed(
            cause = IllegalStateException("Failed to stage cache copy of ${plan.dbName}"),
            partialVersion = current,
        )

        var partialVersion = current
        var db: SQLiteDatabase? = null
        try {
            db = SQLiteDatabase.openDatabase(copy.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
            db.rawQuery("PRAGMA wal_checkpoint(FULL)", null).use { }

            for (step in steps) {
                db.beginTransaction()
                try {
                    for (statement in step.sql) {
                        db.execSQL(statement)
                    }
                    db.execSQL("PRAGMA user_version = ${step.to}")
                    db.setTransactionSuccessful()
                } finally {
                    db.endTransaction()
                }
                partialVersion = step.to
            }
            db.close()
            db = null
            return ReplayResult.Replayed(
                copyPath = copy.absolutePath,
                fromVersion = current,
                toVersion = plan.targetVersion,
            )
        } catch (t: Throwable) {
            try {
                db?.close()
            } catch (_: Throwable) {
            }
            discardCacheCopy(copy)
            return ReplayResult.Failed(cause = t, partialVersion = partialVersion)
        }
    }

    private fun readUserVersion(file: File): Int? = try {
        SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { db ->
            db.rawQuery("PRAGMA user_version", null).use { c ->
                if (c.moveToFirst()) c.getInt(0) else null
            }
        }
    } catch (t: Throwable) {
        null
    }

    private fun stageCacheCopy(context: Context, original: File): File? = try {
        val cacheRoot = File(context.cacheDir, CACHE_SUBDIR).apply { mkdirs() }
        val stagedMain = File(cacheRoot, original.name)
        discardCacheCopy(stagedMain)
        original.copyTo(stagedMain, overwrite = true)
        copySidecarIfExists(original, stagedMain, suffix = "-wal")
        copySidecarIfExists(original, stagedMain, suffix = "-shm")
        stagedMain
    } catch (t: Throwable) {
        null
    }

    private fun copySidecarIfExists(originalMain: File, stagedMain: File, suffix: String) {
        val src = File(originalMain.parentFile, originalMain.name + suffix)
        if (src.exists()) {
            File(stagedMain.parentFile, stagedMain.name + suffix).let { src.copyTo(it, overwrite = true) }
        }
    }

    private fun discardCacheCopy(stagedMain: File) {
        stagedMain.delete()
        File(stagedMain.parentFile, stagedMain.name + "-wal").delete()
        File(stagedMain.parentFile, stagedMain.name + "-shm").delete()
    }

    fun cleanupAll(context: Context) {
        File(context.cacheDir, CACHE_SUBDIR).takeIf { it.exists() }?.deleteRecursively()
    }

    private const val CACHE_SUBDIR = "legacy-migration"
}
