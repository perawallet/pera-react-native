/*
 Copyright 2022-2025 Pera Wallet, LDA
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

type BidaliState = {
    selectedAccount?: WalletAccount
    onClose?: () => void
}

type BidaliActions = {
    setSelectedAccount: (account: WalletAccount) => void
    setOnClose: (fn: () => void) => void
    reset: () => void
}

type BidaliStore = BidaliState & BidaliActions

const initialState: BidaliState = {
    selectedAccount: undefined,
    onClose: undefined,
}

const useBidaliStore = create<BidaliStore>()(set => ({
    ...initialState,
    setSelectedAccount: account => set({ selectedAccount: account }),
    setOnClose: fn => set({ onClose: fn }),
    reset: () => set(initialState),
}))

type UseBidaliResult = {
    selectedAccount?: WalletAccount
    onClose?: () => void
    setSelectedAccount: (account: WalletAccount) => void
    setOnClose: (fn: () => void) => void
    reset: () => void
}

export const useBidali = (): UseBidaliResult => {
    const selectedAccount = useBidaliStore(state => state.selectedAccount)
    const onClose = useBidaliStore(state => state.onClose)
    const setSelectedAccount = useBidaliStore(state => state.setSelectedAccount)
    const setOnClose = useBidaliStore(state => state.setOnClose)
    const reset = useBidaliStore(state => state.reset)

    return { selectedAccount, onClose, setSelectedAccount, setOnClose, reset }
}
