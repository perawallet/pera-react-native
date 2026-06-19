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
package com.algorand.perarn.migration.builder

import com.algorand.perarn.migration.database.AddressDbMigrations
import com.algorand.perarn.migration.database.AlgorandDbMigrations
import com.algorand.perarn.migration.database.BundledMigration
import com.algorand.perarn.migration.database.MigrationPlan
import com.algorand.perarn.migration.database.PeraDbMigrations
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

internal fun composeMigrationPlanSummaries(): WritableArray {
    val out = Arguments.createArray()
    for (plan in BUNDLED_PLANS) {
        out.pushMap(plan.toBridgeMap())
    }
    return out
}

private val BUNDLED_PLANS: List<MigrationPlan> = listOf(
    AddressDbMigrations.PLAN,
    PeraDbMigrations.PLAN,
    AlgorandDbMigrations.PLAN,
)

private fun MigrationPlan.toBridgeMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("dbName", dbName)
    map.putInt("targetVersion", targetVersion)
    map.putInt("oldestSupported", oldestSupported)
    map.putString("readerImpact", readerImpact)
    val migrationsArray = Arguments.createArray()
    for (migration in migrations) {
        migrationsArray.pushMap(migration.toBridgeMap())
    }
    map.putArray("migrations", migrationsArray)
    return map
}

private fun BundledMigration.toBridgeMap(): WritableMap {
    val map = Arguments.createMap()
    map.putInt("from", from)
    map.putInt("to", to)
    map.putString("description", description)
    return map
}
