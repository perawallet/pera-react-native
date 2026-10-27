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

import { runScenario } from './runScenario'
import type {
    BenchScale,
    Scenario,
    ScenarioContext,
    ScenarioRun,
} from './types'

export const runSelection = async (
    entries: readonly { scenario: Scenario; scale: BenchScale }[],
    ctx: ScenarioContext,
    onProgress: (done: number, total: number, current: string) => void,
): Promise<ScenarioRun[]> => {
    const results: ScenarioRun[] = []
    for (const [index, { scenario, scale }] of entries.entries()) {
        onProgress(index, entries.length, `${scenario.id}@${scale.name}`)
        results.push(await runScenario(scenario, scale, ctx))
    }
    onProgress(entries.length, entries.length, '')
    return results
}
