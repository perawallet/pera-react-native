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

import type { StakingProjectInfo } from '../models'
import { stakingProjectsConfigSchema } from '../models/schema'

export const parseStakingProjectsConfig = (
    raw: string,
): StakingProjectInfo[] => {
    // Expected source: Firebase Remote Config key `staking_projects`.
    // Expected value: JSON array of StakingProjectInfo objects.
    if (!raw || !raw.trim()) {
        throw new Error('Missing staking projects remote config value')
    }

    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(raw)
    } catch {
        throw new Error('Invalid staking projects remote config JSON')
    }

    return stakingProjectsConfigSchema.parse(parsedValue)
}
