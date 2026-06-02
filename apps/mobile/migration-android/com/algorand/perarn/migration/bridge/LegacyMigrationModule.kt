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
package com.algorand.perarn.migration.bridge

import android.util.Log
import com.algorand.perarn.migration.builder.LegacyDataBuilder
import com.algorand.perarn.migration.builder.composeMigrationPlanSummaries
import com.algorand.perarn.migration.fixtures.MigrationSimulator
import com.algorand.perarn.migration.tools.LegacyDataInspector
import com.algorand.perarn.migration.tools.LegacyDataWiper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = LegacyMigrationModule.NAME)
class LegacyMigrationModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun hasLegacyData(promise: Promise) {
        try {
            val present = LegacyDataInspector(reactApplicationContext).hasLegacyData()
            promise.resolve(present)
        } catch (t: Throwable) {
            Log.e(LegacyMigrationConstants.LOG_TAG, "hasLegacyData failed", t)
            promise.reject(E_HAS_LEGACY_DATA, t)
        }
    }

    @ReactMethod
    fun getLegacyData(promise: Promise) {
        try {
            val data = LegacyDataBuilder(reactApplicationContext).build()
            promise.resolve(data)
        } catch (t: Throwable) {
            Log.e(LegacyMigrationConstants.LOG_TAG, "getLegacyData failed", t)
            promise.reject(E_GET_LEGACY_DATA, t)
        }
    }

    @ReactMethod
    fun clearLegacyData(promise: Promise) {
        try {
            LegacyDataWiper(reactApplicationContext).clear()
            promise.resolve(null)
        } catch (t: Throwable) {
            Log.e(LegacyMigrationConstants.LOG_TAG, "clearLegacyData failed", t)
            promise.reject(E_CLEAR_LEGACY_DATA, t)
        }
    }

    @ReactMethod
    fun getMigrationPlans(promise: Promise) {
        try {
            promise.resolve(composeMigrationPlanSummaries())
        } catch (t: Throwable) {
            promise.reject(E_GET_MIGRATION_PLANS, t)
        }
    }

    @ReactMethod
    fun simulateLegacyDatabase(args: ReadableMap, promise: Promise) {
        try {
            val dbName = args.getString("dbName")
                ?: throw IllegalArgumentException("dbName is required")
            if (!args.hasKey("version") || args.isNull("version")) {
                throw IllegalArgumentException("version is required")
            }
            val includeUnroutable =
                args.hasKey("includeUnroutableAccounts") &&
                    !args.isNull("includeUnroutableAccounts") &&
                    args.getBoolean("includeUnroutableAccounts")
            val includeAuthState =
                args.hasKey("includeAuthState") &&
                    !args.isNull("includeAuthState") &&
                    args.getBoolean("includeAuthState")
            MigrationSimulator.generate(
                reactApplicationContext,
                dbName,
                args.getInt("version"),
                includeUnroutable,
                includeAuthState,
            )
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject(E_SIMULATE_LEGACY_DATABASE, t)
        }
    }

    @ReactMethod
    fun simulatePreSixxAccounts(promise: Promise) {
        try {
            MigrationSimulator.generatePreSixxAccounts(reactApplicationContext)
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject(E_SIMULATE_PRESIXX_ACCOUNTS, t)
        }
    }

    @ReactMethod
    fun resetLegacyData(promise: Promise) {
        try {
            LegacyDataWiper(reactApplicationContext).forceClear()
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject(E_RESET_LEGACY_DATA, t)
        }
    }

    companion object {
        const val NAME = "LegacyMigration"
        private const val E_HAS_LEGACY_DATA = "E_HAS_LEGACY_DATA"
        private const val E_GET_LEGACY_DATA = "E_GET_LEGACY_DATA"
        private const val E_CLEAR_LEGACY_DATA = "E_CLEAR_LEGACY_DATA"
        private const val E_GET_MIGRATION_PLANS = "E_GET_MIGRATION_PLANS"
        private const val E_SIMULATE_LEGACY_DATABASE = "E_SIMULATE_LEGACY_DATABASE"
        private const val E_SIMULATE_PRESIXX_ACCOUNTS = "E_SIMULATE_PRESIXX_ACCOUNTS"
        private const val E_RESET_LEGACY_DATA = "E_RESET_LEGACY_DATA"
    }
}
