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

/**
 * Bottom padding that ends a vertical scroll body: `spacing.xl` above whatever
 * sits below it, plus the home-indicator inset when nothing else clears it.
 * Zero inside a `PWScreen` or `PWSheetLayout` body, which already carries the
 * gap — a scroller adding its own would double it.
 */
type UseScrollEndGapOptions = {
    isInSheet?: boolean
    /** False for a full-bleed body that should only clear the system UI. */
    hasGap?: boolean
    /** False when something rendered below, such as a button row, already
     * clears the home indicator. */
    hasBottomInset?: boolean
}

export const useScrollEndGap = ({
    isInSheet = false,
    hasGap = true,
    hasBottomInset = true,
}: UseScrollEndGapOptions = {}): number => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()
    const isInTabNavigator = useContext(BottomTabBarHeightContext) !== undefined
    const isNestedInPWScreen = useContext(PWScreenNestedContext)
    const gap = hasGap ? theme.spacing.xl : 0
    const inset = hasBottomInset ? insets.bottom : 0

    if (isNestedInPWScreen) return 0
    // A sheet is edge-to-edge and portaled out of any tab bar.
    if (isInSheet) return gap + inset
    if (isInTabNavigator) return gap
    return gap + inset
}
