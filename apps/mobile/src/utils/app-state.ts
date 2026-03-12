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

export type AppStateValue = string | null | undefined

const ACTIVE_STATE = 'active'
const BACKGROUND_LIKE_STATES = new Set(['inactive', 'background'])

export const isActiveAppState = (state: AppStateValue): boolean =>
    state === ACTIVE_STATE

export const isBackgroundLikeAppState = (state: AppStateValue): boolean =>
    typeof state === 'string' && BACKGROUND_LIKE_STATES.has(state)

export const isForegroundTransition = (
    previousState: AppStateValue,
    nextState: AppStateValue,
): boolean =>
    isBackgroundLikeAppState(previousState) && isActiveAppState(nextState)

export const isBackgroundTransition = (
    previousState: AppStateValue,
    nextState: AppStateValue,
): boolean =>
    isActiveAppState(previousState) && isBackgroundLikeAppState(nextState)

export type PollingTransitionAction = 'start' | 'stop' | null

export const getPollingTransitionAction = (
    previousState: AppStateValue,
    nextState: AppStateValue,
): PollingTransitionAction => {
    if (isForegroundTransition(previousState, nextState)) {
        return 'start'
    }

    if (isBackgroundTransition(previousState, nextState)) {
        return 'stop'
    }

    return null
}
