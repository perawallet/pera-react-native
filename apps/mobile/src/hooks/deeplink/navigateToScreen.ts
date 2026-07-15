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
