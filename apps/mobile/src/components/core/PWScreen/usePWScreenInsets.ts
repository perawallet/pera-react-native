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

export type UsePWScreenInsetsResult = {
    bottomInset: number
    isInTabNavigator: boolean
}

/**
 * Effective bottom inset for a screen body. Returns 0 inside a bottom-tab
 * navigator, whose tab bar already clears the home indicator (adding inset
 * would double-pad).
 */
export const usePWScreenInsets = (): UsePWScreenInsetsResult => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()
    const tabBarHeight = useContext(BottomTabBarHeightContext)
    const isInTabNavigator = tabBarHeight !== undefined

    return {
        bottomInset: isInTabNavigator ? 0 : insets.bottom + theme.spacing.lg,
        isInTabNavigator,
    }
}
