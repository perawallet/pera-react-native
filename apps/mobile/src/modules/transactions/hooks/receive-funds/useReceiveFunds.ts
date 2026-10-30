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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { registerStore } from '@perawallet/wallet-core-shared'

type ReceiveFundsState = {
    selectedAccount?: WalletAccount
    /** Pins the QR to this chain; unset resolves the account's own receive chain. */
    chainId?: ChainId
    canSelectAccount: boolean
    onFinished?: () => void
}

type ReceiveFundsActions = {
    setSelectedAccount: (account?: WalletAccount) => void
    setChainId: (chainId?: ChainId) => void
    setCanSelectAccount: (canSelect: boolean) => void
    setOnFinished: (fn: () => void) => void
    reset: () => void
}

type ReceiveFundsStore = ReceiveFundsState & ReceiveFundsActions

const initialState: ReceiveFundsState = {
    selectedAccount: undefined,
    chainId: undefined,
    canSelectAccount: true,
    onFinished: undefined,
}

export const useReceiveFundsStore = create<ReceiveFundsStore>()(set => ({
    ...initialState,
    setSelectedAccount: account => set({ selectedAccount: account }),
    setChainId: chainId => set({ chainId }),
    setCanSelectAccount: canSelect => set({ canSelectAccount: canSelect }),
    setOnFinished: fn => set({ onFinished: fn }),
    reset: () => set(initialState),
}))

registerStore({
    name: 'receive-funds-store',
    clearStorage: () => {},
    resetState: () => useReceiveFundsStore.getState().reset(),
})

type UseReceiveFundsResult = {
    selectedAccount?: WalletAccount
    chainId?: ChainId
    canSelectAccount: boolean
    onFinished?: () => void
    setSelectedAccount: (account?: WalletAccount) => void
    setChainId: (chainId?: ChainId) => void
    setCanSelectAccount: (canSelect: boolean) => void
    setOnFinished: (fn: () => void) => void
    reset: () => void
}

export const useReceiveFunds = (): UseReceiveFundsResult => {
    const selectedAccount = useReceiveFundsStore(state => state.selectedAccount)
    const chainId = useReceiveFundsStore(state => state.chainId)
    const canSelectAccount = useReceiveFundsStore(
        state => state.canSelectAccount,
    )
    const onFinished = useReceiveFundsStore(state => state.onFinished)
    const setSelectedAccount = useReceiveFundsStore(
        state => state.setSelectedAccount,
    )
    const setChainId = useReceiveFundsStore(state => state.setChainId)
    const setCanSelectAccount = useReceiveFundsStore(
        state => state.setCanSelectAccount,
    )
    const setOnFinished = useReceiveFundsStore(state => state.setOnFinished)
    const reset = useReceiveFundsStore(state => state.reset)

    return {
        selectedAccount,
        chainId,
        canSelectAccount,
        onFinished,
        setSelectedAccount,
        setChainId,
        setCanSelectAccount,
        setOnFinished,
        reset,
    }
}
