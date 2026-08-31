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

import { useCallback, useEffect, useState } from 'react'
import { BackHandler } from 'react-native'
import {
    useSharedValue,
    withSpring,
    type SharedValue,
} from 'react-native-reanimated'
import { PWDRAWER_SPRING_CONFIG } from '@components/core/PWDrawer/constants'
import { useAccountSwitcherActions } from '@modules/accounts/hooks/useAccountSwitcherActions'

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

    const openDrawer = useCallback(() => {
        progress.value = withSpring(1, PWDRAWER_SPRING_CONFIG)
        setIsOpen(true)
    }, [progress])

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
    // there on the way back — so every navigating action closes first.
    const closeThen = useCallback(
        (action: () => void) => {
            closeDrawer()
            action()
        },
        [closeDrawer],
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
