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

import { StackActions } from '@react-navigation/native'
import { navigationRef } from '@routes/navigationRef'
import type { AppStackParamList } from '@routes/types'

/**
 * Shared navigation helper for deeplink handlers. Goes through the global
 * navigationRef rather than `useNavigation` because deeplinks are dispatched
 * from outside any specific screen — listener hooks, QR scanner, push
 * notifications.
 */
export const navigateToScreen = (
    replaceCurrentScreen: boolean,
    screenName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any,
): void => {
    if (!navigationRef.isReady()) return
    if (replaceCurrentScreen) {
        navigationRef.dispatch(StackActions.replace(screenName, params))
    } else {
        navigationRef.navigate(screenName, params)
    }
}

/**
 * Same reasoning as `navigateToScreen`, for callers that need `push` rather
 * than `navigate`. Needed because `useHandleInboxItemPress` is shared between
 * the inbox list (rendered inside the navigator) and the push-notification
 * listener, which `RootComponent` mounts *above* `NavigationContainer` — so it
 * cannot reach navigation through `useAppNavigation`/`useNavigation` at all.
 *
 * `StackActions.push`, not `navigationRef.navigate`: `navigate` would reuse an
 * already-focused Messages route and only swap its params, which silently
 * changes the back stack for the list path that previously called
 * `useAppNavigation().push`.
 */
export const pushScreen = <RouteName extends keyof AppStackParamList>(
    screenName: RouteName,
    params?: AppStackParamList[RouteName],
): void => {
    if (!navigationRef.isReady()) return
    navigationRef.dispatch(StackActions.push(screenName as string, params))
}
