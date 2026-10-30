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
import { registerStore, type Nullable } from '@perawallet/wallet-core-shared'

/** The account screen tabs a link may open on. */
export type RequestedAccountTab = 'History'

type AccountTabRequestState = {
    requestedTab: Nullable<RequestedAccountTab>
}

type AccountTabRequestActions = {
    requestAccountTab: (tab: RequestedAccountTab) => void
}

type AccountTabRequestStore = AccountTabRequestState & AccountTabRequestActions

/**
 * Asks the account screen to show a tab from outside it (an `account-detail`
 * link with `tab=history`, which the Transactions widget opens). A flag rather
 * than an event: the request arrives before the account's screen has mounted.
 */
export const useAccountTabRequestStore = create<AccountTabRequestStore>()(
    set => ({
        requestedTab: null,
        requestAccountTab: tab => set({ requestedTab: tab }),
    }),
)

registerStore({
    name: 'account-tab-request-store',
    clearStorage: () => {},
    resetState: () =>
        useAccountTabRequestStore.setState({ requestedTab: null }),
})

/**
 * Selects the requested tab once the screen offers it. A tab the account's
 * chain doesn't have is dropped rather than left waiting for a later account.
 */
export const useAccountTabRequest = (
    tabKeys: readonly string[],
    select: (index: number) => void,
): void => {
    const requestedTab = useAccountTabRequestStore(state => state.requestedTab)

    useEffect(() => {
        if (requestedTab === null) return
        useAccountTabRequestStore.setState({ requestedTab: null })
        const index = tabKeys.indexOf(requestedTab)
        if (index >= 0) select(index)
    }, [requestedTab, tabKeys, select])
}
