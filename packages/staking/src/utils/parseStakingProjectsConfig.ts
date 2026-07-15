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

import type { StakingProjectInfo } from '../models'
import { stakingProjectsConfigSchema } from '../models/schema'

/**
 * Parse Firebase Remote Config key `staking_projects` (a JSON array of
 * StakingProjectInfo objects).
 *
 * Returns an empty array when the value is absent — Firebase hasn't fetched
 * yet, the key isn't set in the active environment, etc. — so callers render
 * an empty state instead of crashing the screen. Throws on actual JSON parse
 * or schema validation errors; the hook layer catches and surfaces those via
 * its error state.
 */
export const parseStakingProjectsConfig = (
    raw: string,
): StakingProjectInfo[] => {
    if (!raw || !raw.trim()) {
        return []
    }

    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(raw)
    } catch {
        throw new Error('Invalid staking projects remote config JSON')
    }

    return stakingProjectsConfigSchema.parse(parsedValue)
}
