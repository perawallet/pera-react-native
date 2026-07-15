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

import { create } from 'zustand'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

type ReceiveFundsState = {
    selectedAccount?: WalletAccount
    canSelectAccount: boolean
    onFinished?: () => void
}

type ReceiveFundsActions = {
    setSelectedAccount: (account?: WalletAccount) => void
    setCanSelectAccount: (canSelect: boolean) => void
    setOnFinished: (fn: () => void) => void
    reset: () => void
}

type ReceiveFundsStore = ReceiveFundsState & ReceiveFundsActions

const initialState: ReceiveFundsState = {
    selectedAccount: undefined,
    canSelectAccount: true,
    onFinished: undefined,
}

export const useReceiveFundsStore = create<ReceiveFundsStore>()(set => ({
    ...initialState,
    setSelectedAccount: account => set({ selectedAccount: account }),
    setCanSelectAccount: canSelect => set({ canSelectAccount: canSelect }),
    setOnFinished: fn => set({ onFinished: fn }),
    reset: () => set(initialState),
}))

type UseReceiveFundsResult = {
    selectedAccount?: WalletAccount
    canSelectAccount: boolean
    onFinished?: () => void
    setSelectedAccount: (account?: WalletAccount) => void
    setCanSelectAccount: (canSelect: boolean) => void
    setOnFinished: (fn: () => void) => void
    reset: () => void
}

export const useReceiveFunds = (): UseReceiveFundsResult => {
    const selectedAccount = useReceiveFundsStore(state => state.selectedAccount)
    const canSelectAccount = useReceiveFundsStore(
        state => state.canSelectAccount,
    )
    const onFinished = useReceiveFundsStore(state => state.onFinished)
    const setSelectedAccount = useReceiveFundsStore(
        state => state.setSelectedAccount,
    )
    const setCanSelectAccount = useReceiveFundsStore(
        state => state.setCanSelectAccount,
    )
    const setOnFinished = useReceiveFundsStore(state => state.setOnFinished)
    const reset = useReceiveFundsStore(state => state.reset)

    return {
        selectedAccount,
        canSelectAccount,
        onFinished,
        setSelectedAccount,
        setCanSelectAccount,
        setOnFinished,
        reset,
    }
}
