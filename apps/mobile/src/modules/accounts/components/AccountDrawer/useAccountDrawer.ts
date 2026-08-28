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
import { useAccountSwitcherActions } from '@modules/accounts/hooks/useAccountSwitcherActions'

export type UseAccountDrawerResult = {
    isOpen: boolean
    openDrawer: () => void
    closeDrawer: () => void
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

    const openDrawer = useCallback(() => setIsOpen(true), [])
    const closeDrawer = useCallback(() => setIsOpen(false), [])

    // The drawer lives inside the tab screen, so react-navigation's back
    // handler would pop the tab out from under an open drawer. Claim back
    // while it's open and just close instead. (Inert on iOS.)
    useEffect(() => {
        if (!isOpen) return

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                setIsOpen(false)
                return true
            },
        )

        return () => subscription.remove()
    }, [isOpen])

    // Every navigating action closes first: pushing a screen over an open
    // drawer otherwise leaves it open behind, and it's still there on the way
    // back. Selecting an account is the exception-free case — AccountMenu has
    // already written the global selection by the time this fires.
    const closeThen = useCallback((action: () => void) => {
        setIsOpen(false)
        action()
    }, [])

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

    // Sorting doesn't navigate — the sheet is a portal above the drawer, so
    // the list stays put underneath and re-sorts in place.
    const handleOpenSort = useCallback(() => {
        void openSort()
    }, [openSort])

    return {
        isOpen,
        openDrawer,
        closeDrawer,
        handleSelected: closeDrawer,
        handleAddAccount,
        handleSearch,
        handlePeraCardActivate,
        handlePeraCardOpen,
        handleOpenSort,
    }
}
