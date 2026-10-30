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

import { useEffect } from 'react'
import { create } from 'zustand'
import { registerStore, type Optional } from '@perawallet/wallet-core-shared'

type AccountDrawerRequestState = {
    isRequested: boolean
    /** Select the first account in the drawer's list once it has sorted. */
    isFirstAccountPending: boolean
}

type AccountDrawerRequestActions = {
    requestAccountDrawer: () => void
}

type AccountDrawerRequestStore = AccountDrawerRequestState &
    AccountDrawerRequestActions

/**
 * Asks the account drawer to open from outside it (the portfolio deep link a
 * Portfolio widget opens). A flag rather than an event: the request may arrive
 * before the tab shell, and with it the drawer, has mounted.
 */
export const useAccountDrawerRequestStore = create<AccountDrawerRequestStore>()(
    set => ({
        isRequested: false,
        isFirstAccountPending: false,
        requestAccountDrawer: () =>
            set({ isRequested: true, isFirstAccountPending: true }),
    }),
)

registerStore({
    name: 'account-drawer-request-store',
    clearStorage: () => {},
    resetState: () =>
        useAccountDrawerRequestStore.setState({
            isRequested: false,
            isFirstAccountPending: false,
        }),
})

/** Opens the drawer for each pending request, including one made before mount. */
export const useAccountDrawerRequest = (open: () => void): void => {
    const isRequested = useAccountDrawerRequestStore(state => state.isRequested)

    useEffect(() => {
        if (!isRequested) return
        useAccountDrawerRequestStore.setState({ isRequested: false })
        open()
    }, [isRequested, open])
}

/**
 * Selects the first account of the drawer's sorted list for a pending request:
 * a widget showing the whole portfolio opens on the default account, not
 * whichever was last selected. Waits for the list, which can be empty while
 * accounts load.
 */
export const useFirstAccountRequest = (
    firstAccountId: Optional<string>,
    select: (accountId: string) => void,
): void => {
    const isPending = useAccountDrawerRequestStore(
        state => state.isFirstAccountPending,
    )

    useEffect(() => {
        if (!isPending || firstAccountId === undefined) return
        useAccountDrawerRequestStore.setState({ isFirstAccountPending: false })
        select(firstAccountId)
    }, [isPending, firstAccountId, select])
}
