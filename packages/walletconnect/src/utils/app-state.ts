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

import { Platform } from 'react-native'
import type { Maybe } from '@perawallet/wallet-core-shared'

/**
 * RN AppState helpers scoped to what the WalletConnect foreground-reconnect
 * hook needs. The app exposes a fuller set of helpers (background-transition,
 * polling action) at `@utils/app-state`; only the foreground-transition
 * detection is duplicated here so the hook can live in this package.
 */

const ACTIVE_STATE = 'active'
const IOS_BACKGROUND_LIKE_STATES = new Set(['inactive', 'background'])

export type AppStatePlatform = 'ios' | 'android' | 'web'
type AppStateValue = Maybe<string>

export const getAppStatePlatform = (): AppStatePlatform => {
    if (Platform.OS === 'ios') return 'ios'
    if (Platform.OS === 'web') return 'web'
    return 'android'
}

const isActiveAppState = (state: AppStateValue): boolean =>
    state === ACTIVE_STATE

const isBackgroundLikeAppState = (
    state: AppStateValue,
    platform: AppStatePlatform,
): boolean => {
    if (typeof state !== 'string') return false
    if (platform === 'ios') return IOS_BACKGROUND_LIKE_STATES.has(state)
    // Android treats only real background as background-like, ignoring
    // noisy inactive → active transitions.
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
    // android and web share the strict two-state model: android because
    // inactive→active transitions are noise there, web because
    // react-native-web's AppState (document.visibilitychange) only ever
    // emits 'active' and 'background'.
    return previousState === 'background' && nextState === 'active'
}
