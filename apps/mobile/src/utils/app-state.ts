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

import { Platform, type AppStateStatus } from 'react-native'

type KnownAppState = 'active' | 'inactive' | 'background'

export type AppStatePlatform = 'ios' | 'android'
export type AppStateValue = AppStateStatus | string | null | undefined

export type AppStateTransition = {
    didLeaveForeground: boolean
    didEnterForeground: boolean
}

const IOS_BACKGROUND_STATES = new Set<KnownAppState>(['inactive', 'background'])

const normalizeAppState = (state: AppStateValue): KnownAppState | null => {
    if (state === 'active' || state === 'inactive' || state === 'background') {
        return state
    }

    return null
}

export const getAppStatePlatform = (): AppStatePlatform => {
    return Platform.OS === 'ios' ? 'ios' : 'android'
}

export const getAppStateTransition = (
    previousState: AppStateValue,
    nextState: AppStateValue,
    platform: AppStatePlatform = getAppStatePlatform(),
): AppStateTransition => {
    const previous = normalizeAppState(previousState)
    const next = normalizeAppState(nextState)

    if (!previous || !next || previous === next) {
        return {
            didLeaveForeground: false,
            didEnterForeground: false,
        }
    }

    if (platform === 'ios') {
        return {
            didLeaveForeground:
                previous === 'active' && IOS_BACKGROUND_STATES.has(next),
            didEnterForeground:
                IOS_BACKGROUND_STATES.has(previous) && next === 'active',
        }
    }

    return {
        // On Android, we only treat a real background transition as leaving
        // foreground to ignore noisy inactive->active transitions.
        didLeaveForeground: previous !== 'background' && next === 'background',
        didEnterForeground: previous === 'background' && next === 'active',
    }
}
