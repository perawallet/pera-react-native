/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import ExpoModulesCore

struct SimulateLegacyDatabaseArgs: Record {
  @Field var dbName: String = ""
  @Field var version: Int = LegacyMigrationConstants.simulatorVersion
  @Field var includeUnroutableAccounts: Bool = false
  @Field var includeAuthState: Bool = false
}

public class LegacyMigrationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LegacyMigration")

    AsyncFunction("hasLegacyData") { () -> Bool in
      AppGroupResolver.shared.hasLegacyData()
    }

    AsyncFunction("getLegacyData") { () throws -> Any in
      try LegacyDataBuilder().build()
    }

    AsyncFunction("getMigrationPlans") { () -> [[String: Any]] in
      [[
        "dbName": LegacyMigrationConstants.simulatorStoreName,
        "targetVersion": LegacyMigrationConstants.simulatorVersion,
        "oldestSupported": LegacyMigrationConstants.simulatorVersion,
        "readerImpact":
          "iOS legacy store: Core Data (User blob, contacts, passkeys) + "
          + "Keychain (algo25 / HD keys, PIN, biometric) + App Group "
          + "UserDefaults (preferences). No schema versioning — tolerant "
          + "decode handles every legacy version. Generate writes the full "
          + "fixture set in one call.",
        "migrations": [Any](),
      ]]
    }

    AsyncFunction("simulateLegacyDatabase") { (args: SimulateLegacyDatabaseArgs) throws in
      try MigrationSimulator.generate(
        dbName: args.dbName,
        version: args.version,
        includeUnroutable: args.includeUnroutableAccounts,
        includeAuthState: args.includeAuthState
      )
    }

    AsyncFunction("resetLegacyData") { () in
      LegacyDataWiper().forceClear()
    }
  }
}
