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

import { Platform } from 'react-native'

const ACTIVE_STATE = 'active'
const IOS_BACKGROUND_LIKE_STATES = new Set(['inactive', 'background'])

export type AppStatePlatform = 'ios' | 'android'
export type AppStateValue = string | null | undefined

export type AppStateTransition = {
    didLeaveForeground: boolean
    didEnterForeground: boolean
}

export const getAppStatePlatform = (): AppStatePlatform =>
    Platform.OS === 'ios' ? 'ios' : 'android'

export const isActiveAppState = (state: AppStateValue): boolean =>
    state === ACTIVE_STATE

export const isBackgroundLikeAppState = (
    state: AppStateValue,
    platform: AppStatePlatform = getAppStatePlatform(),
): boolean => {
    if (typeof state !== 'string') {
        return false
    }

    if (platform === 'ios') {
        return IOS_BACKGROUND_LIKE_STATES.has(state)
    }

    // On Android, treat only real background as background-like
    // to ignore noisy inactive -> active transitions.
    return state === 'background'
}

export const isForegroundTransition = (
    previousState: AppStateValue,
    nextState: AppStateValue,
    platform: AppStatePlatform = getAppStatePlatform(),
): boolean => {
    if (platform === 'ios') {
        return (
            isBackgroundLikeAppState(previousState, platform) &&
            isActiveAppState(nextState)
        )
    }

    return previousState === 'background' && nextState === 'active'
}

export const isBackgroundTransition = (
    previousState: AppStateValue,
    nextState: AppStateValue,
    platform: AppStatePlatform = getAppStatePlatform(),
): boolean => {
    if (platform === 'ios') {
        return (
            isActiveAppState(previousState) &&
            isBackgroundLikeAppState(nextState, platform)
        )
    }

    return previousState !== 'background' && nextState === 'background'
}

export type PollingTransitionAction = 'start' | 'stop' | null

export const getPollingTransitionAction = (
    previousState: AppStateValue,
    nextState: AppStateValue,
    platform: AppStatePlatform = getAppStatePlatform(),
): PollingTransitionAction => {
    if (isForegroundTransition(previousState, nextState, platform)) {
        return 'start'
    }

    if (isBackgroundTransition(previousState, nextState, platform)) {
        return 'stop'
    }

    return null
}

export const getAppStateTransition = (
    previousState: AppStateValue,
    nextState: AppStateValue,
    platform: AppStatePlatform = getAppStatePlatform(),
): AppStateTransition => ({
    didLeaveForeground: isBackgroundTransition(
        previousState,
        nextState,
        platform,
    ),
    didEnterForeground: isForegroundTransition(previousState, nextState, platform),
})
