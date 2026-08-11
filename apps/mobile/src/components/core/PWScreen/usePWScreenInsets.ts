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

import { useContext } from 'react'
import { useTheme } from '@rneui/themed'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { PWScreenNestedContext } from './nestedContext'

export type UsePWScreenInsetsResult = {
    bottomInset: number
    isBottomHandledOutside: boolean
}

/**
 * Effective bottom inset for a screen body. Returns 0 when something outside
 * the screen already clears the home indicator: a bottom-tab navigator's tab
 * bar, or an enclosing `PWScreen` whose body padding wraps this one (adding
 * inset would double-pad).
 */
export const usePWScreenInsets = (): UsePWScreenInsetsResult => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()
    const tabBarHeight = useContext(BottomTabBarHeightContext)
    const isNestedInPWScreen = useContext(PWScreenNestedContext)
    const isBottomHandledOutside =
        tabBarHeight !== undefined || isNestedInPWScreen

    return {
        bottomInset: isBottomHandledOutside
            ? 0
            : insets.bottom + theme.spacing.lg,
        isBottomHandledOutside,
    }
}
