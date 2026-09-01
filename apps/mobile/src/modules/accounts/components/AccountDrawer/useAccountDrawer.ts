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

import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler } from 'react-native'
import {
    useSharedValue,
    withSpring,
    type SharedValue,
} from 'react-native-reanimated'
import { PWDRAWER_SPRING_CONFIG } from '@components/core/PWDrawer/constants'
import { SCREEN_ANIMATION_DURATION_MS } from '@constants/ui'
import { useAccountSwitcherActions } from '@modules/accounts/hooks/useAccountSwitcherActions'

/**
 * When the panel is snapped away after a navigation, in ms. Keyed off the push
 * transition so the cut lands once the incoming screen has settled rather than
 * over its last frames; the margin covers the frame the timer can land between.
 */
const POST_NAVIGATE_RESET_DELAY = SCREEN_ANIMATION_DURATION_MS * 8

export type UseAccountDrawerResult = {
    isOpen: boolean
    /** 0-1 open progress. The single source of truth for the animation. */
    progress: SharedValue<number>
    /** Animates and updates state — for taps, back, and selection. */
    openDrawer: () => void
    closeDrawer: () => void
    /**
     * Records a state a gesture has already animated to. Separate from
     * `openDrawer`/`closeDrawer` because a gesture settles `progress` itself
     * carrying the finger's velocity, and animating again would restart that
     * spring from a standstill partway through.
     */
    markOpen: () => void
    markClosed: () => void
    handleSelected: () => void
    handleAddAccount: () => void
    handleSearch: () => void
    handlePeraCardActivate: () => void
    handlePeraCardOpen: () => void
    handleOpenSort: () => void
}

export const useAccountDrawer = (): UseAccountDrawerResult => {
    const [isOpen, setIsOpen] = useState(false)
    const {
        goToAddAccount,
        goToSearch,
        goToPeraCardActivation,
        openPeraCard,
        openSort,
    } = useAccountSwitcherActions()

    const progress = useSharedValue(0)

    const markOpen = useCallback(() => setIsOpen(true), [])
    const markClosed = useCallback(() => setIsOpen(false), [])

    // A navigating close leaves this armed to snap the panel away once the
    // pushed screen covers it — see closeThen.
    const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const clearPendingReset = useCallback(() => {
        if (!resetTimerRef.current) return

        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = undefined
    }, [])

    useEffect(() => clearPendingReset, [clearPendingReset])

    const openDrawer = useCallback(() => {
        // Reopening within the delay would otherwise be snapped shut by the
        // reset still pending from the last navigation.
        clearPendingReset()
        progress.value = withSpring(1, PWDRAWER_SPRING_CONFIG)
        setIsOpen(true)
    }, [progress, clearPendingReset])

    const closeDrawer = useCallback(() => {
        progress.value = withSpring(0, PWDRAWER_SPRING_CONFIG)
        setIsOpen(false)
    }, [progress])

    // react-navigation's back handler would otherwise pop the tab out from under
    // an open drawer. Inert on iOS.
    useEffect(() => {
        if (!isOpen) return

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                closeDrawer()
                return true
            },
        )

        return () => subscription.remove()
    }, [isOpen, closeDrawer])

    // Pushing a screen over an open drawer leaves it open behind, and it's still
    // there on the way back — so every navigating action has to close it. The
    // panel is left up while the push runs and snapped away underneath it after:
    // closing first puts the destination's mount cost between the close and the
    // push, which reads as a stall no matter whether the close is sprung or cut.
    // Navigating first spends that mount while the panel is still standing, so
    // the push is the only motion ever seen.
    const closeThen = useCallback(
        (action: () => void) => {
            setIsOpen(false)
            action()

            clearPendingReset()
            resetTimerRef.current = setTimeout(() => {
                resetTimerRef.current = undefined
                progress.value = 0
            }, POST_NAVIGATE_RESET_DELAY)
        },
        [progress, clearPendingReset],
    )

    const handleAddAccount = useCallback(
        () => closeThen(goToAddAccount),
        [closeThen, goToAddAccount],
    )
    const handleSearch = useCallback(
        () => closeThen(goToSearch),
        [closeThen, goToSearch],
    )
    const handlePeraCardActivate = useCallback(
        () => closeThen(goToPeraCardActivation),
        [closeThen, goToPeraCardActivation],
    )
    const handlePeraCardOpen = useCallback(
        () => closeThen(openPeraCard),
        [closeThen, openPeraCard],
    )

    // Sorting doesn't navigate: the sheet is a portal above the drawer, so the
    // list stays put underneath and re-sorts in place.
    const handleOpenSort = useCallback(() => {
        void openSort()
    }, [openSort])

    return {
        isOpen,
        progress,
        openDrawer,
        closeDrawer,
        markOpen,
        markClosed,
        handleSelected: closeDrawer,
        handleAddAccount,
        handleSearch,
        handlePeraCardActivate,
        handlePeraCardOpen,
        handleOpenSort,
    }
}
