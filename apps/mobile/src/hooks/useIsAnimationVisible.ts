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

import { createContext, useContext, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { NavigationContext } from '@react-navigation/native'
import { useIsLockOverlayVisible } from '@hooks/useIsLockOverlayVisible'
import { isBackgroundLikeAppState } from '@utils/app-state'

// Set by containers that keep their content mounted while hiding it (a
// collapsed ExpandablePanel), and by PWBottomSheet to carry its owner's
// visibility across the portal, which drops every context above the sheet.
const HiddenContainerContext = createContext(false)

export const HiddenContainerProvider = HiddenContainerContext.Provider

export const useIsInHiddenContainer = (): boolean =>
    useContext(HiddenContainerContext)

const useIsAppForeground = (): boolean => {
    const [isForeground, setIsForeground] = useState(
        () => !isBackgroundLikeAppState(AppState.currentState),
    )

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            setIsForeground(!isBackgroundLikeAppState(nextState))
        })
        return () => subscription.remove()
    }, [])

    return isForeground
}

// useIsFocused throws outside a navigator, and spinners also render in the
// root overlays and in sheets, so outside one a screen counts as focused.
const useIsScreenFocused = (): boolean => {
    const navigation = useContext(NavigationContext)
    const [isFocused, setIsFocused] = useState(
        () => navigation?.isFocused() ?? true,
    )

    useEffect(() => {
        if (!navigation) return
        setIsFocused(navigation.isFocused())
        const unsubscribeFocus = navigation.addListener('focus', () =>
            setIsFocused(true),
        )
        const unsubscribeBlur = navigation.addListener('blur', () =>
            setIsFocused(false),
        )
        return () => {
            unsubscribeFocus()
            unsubscribeBlur()
        }
    }, [navigation])

    return isFocused
}

export const useIsAnimationVisible = (): boolean => {
    const isAppForeground = useIsAppForeground()
    const isScreenFocused = useIsScreenFocused()
    const isLockOverlayVisible = useIsLockOverlayVisible()
    const isInHiddenContainer = useIsInHiddenContainer()

    return (
        isAppForeground &&
        isScreenFocused &&
        !isLockOverlayVisible &&
        !isInHiddenContainer
    )
}
