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

import type {
    LegacyCheckDeps,
    LegacyCheckReport,
    ResealDeps,
    ResealReport,
} from './resealTypes'

// Native twins of the web sweep: the React Native driver has never held an
// auto-generated engine key, so there is nothing to move. Zeroed rather than
// throwing, matching the other web/native maintenance twins.

export const resealLegacyMaterialWith = async (
    _deps: ResealDeps,
): Promise<ResealReport> => ({
    resealed: 0,
    unrecoverable: [],
    legacyKeyRemoved: false,
})

export const discardLegacyKeyWith = async (
    _deps: ResealDeps,
): Promise<ResealReport> => ({
    resealed: 0,
    unrecoverable: [],
    legacyKeyRemoved: false,
})

export const checkLegacyMaterialWith = async (
    _deps: LegacyCheckDeps,
): Promise<LegacyCheckReport> => ({
    reminted: 0,
    unrecoverable: [],
})
