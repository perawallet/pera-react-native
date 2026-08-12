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

import { createContext, useContext } from 'react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseAccountOverviewModalResult = {
    account: WalletAccount
    openSendFunds: () => void
    openReceiveFunds: () => void
    openAccountOptions: () => void
}

export const AccountOverviewModalContext =
    createContext<Nullable<UseAccountOverviewModalResult>>(null)

export const useAccountOverviewModal = (): UseAccountOverviewModalResult => {
    const context = useContext(AccountOverviewModalContext)
    if (context === null) {
        throw new Error(
            'useAccountOverviewModal must be used within AccountOverviewModalContext.Provider',
        )
    }
    return context
}
