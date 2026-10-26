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

import type { Scenario } from '../runner/types'
import { dbScenarios } from './db'
import { importAndBackupScenarios } from './importAndBackup'
import { memoryScenarios } from './memory'
import { signingScenarios } from './signing'
import { startupScenarios } from './startup'
import { syncScenarios } from './sync'

const all: Scenario[] = [
    ...startupScenarios,
    ...dbScenarios,
    ...syncScenarios,
    ...importAndBackupScenarios,
    ...signingScenarios,
    ...memoryScenarios,
]

const duplicate = all.find(
    (scenario, index) =>
        all.findIndex(other => other.id === scenario.id) !== index,
)
if (duplicate) {
    throw new Error(`Two scenarios share the id ${duplicate.id}`)
}

export const SCENARIOS: readonly Scenario[] = all
