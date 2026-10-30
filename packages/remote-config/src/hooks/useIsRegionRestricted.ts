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

import { useMemo } from 'react'
import {
    isRegionRestricted,
    regionRestrictedFeatures,
    type RegionRestrictedFeature,
} from '../utils/regionRestrictions'
import { useRemoteConfig } from './useRemoteConfig'

export const useIsRegionRestricted = (
    feature: RegionRestrictedFeature,
): boolean => isRegionRestricted(useRemoteConfig(), feature)

export const useRegionRestrictedFeatures = (): string[] => {
    // Joined so the array keeps its identity until the features change.
    const joined = regionRestrictedFeatures(useRemoteConfig()).join(',')
    return useMemo(() => (joined ? joined.split(',') : []), [joined])
}
