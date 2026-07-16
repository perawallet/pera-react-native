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
package com.algorand.perarn.migration.bridge

import com.algorand.perarn.migration.builder.LegacyDataBuilder
import com.algorand.perarn.migration.builder.composeMigrationPlanSummaries
import com.algorand.perarn.migration.fixtures.MigrationSimulator
import com.algorand.perarn.migration.tools.LegacyDataInspector
import com.algorand.perarn.migration.tools.LegacyDataWiper
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SimulateLegacyDatabaseArgs : Record {
  @Field var dbName: String = ""
  @Field var version: Int = 0
  @Field var includeUnroutableAccounts: Boolean = false
  @Field var includeAuthState: Boolean = false
}

class LegacyMigrationModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LegacyMigration")

    AsyncFunction("hasLegacyData") {
      LegacyDataInspector(context).hasLegacyData()
    }

    AsyncFunction("getLegacyData") {
      LegacyDataBuilder(context).build().toHashMap()
    }

    AsyncFunction("getMigrationPlans") {
      composeMigrationPlanSummaries().toArrayList()
    }

    AsyncFunction("simulateLegacyDatabase") { args: SimulateLegacyDatabaseArgs ->
      require(args.dbName.isNotEmpty()) { "dbName is required" }
      MigrationSimulator.generate(
        context,
        args.dbName,
        args.version,
        args.includeUnroutableAccounts,
        args.includeAuthState,
      )
    }

    AsyncFunction("simulatePreSixxAccounts") {
      MigrationSimulator.generatePreSixxAccounts(context)
    }

    AsyncFunction("resetLegacyData") {
      LegacyDataWiper(context).forceClear()
    }
  }
}
