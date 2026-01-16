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
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import Decimal from 'decimal.js'

type SendFundsState = {
    selectedAsset?: AssetWithAccountBalance
    canSelectAsset: boolean
    amount?: Decimal
    note?: string
    destination?: string
}

type SendFundsActions = {
    setSelectedAsset: (asset?: AssetWithAccountBalance) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    reset: () => void
}

type SendFundsStore = SendFundsState & SendFundsActions

const initialState: SendFundsState = {
    selectedAsset: undefined,
    canSelectAsset: true,
    amount: undefined,
    note: undefined,
    destination: undefined,
}

/**
 * Internal Zustand store for managing the state of a "Send Funds" transaction flow.
 * Use useSendFunds hook for component access.
 */
export const useSendFundsStore = create<SendFundsStore>()(set => ({
    ...initialState,
    setSelectedAsset: asset => set({ selectedAsset: asset }),
    setCanSelectAsset: canSelect => set({ canSelectAsset: canSelect }),
    setAmount: amount => set({ amount }),
    setNote: note => set({ note }),
    setDestination: address => set({ destination: address }),
    reset: () => set(initialState),
}))

// Explicit return types for decoupled access

/**
 * Result of the useSendFunds hook.
 */
type UseSendFundsResult = {
    /** The asset being sent */
    selectedAsset?: AssetWithAccountBalance
    /** Whether the user is allowed to change the selected asset */
    canSelectAsset: boolean
    /** Amount to send */
    amount?: Decimal
    /** Optional transaction note */
    note?: string
    /** Destination wallet address */
    destination?: string
    /** Updates the selected asset */
    setSelectedAsset: (asset?: AssetWithAccountBalance) => void
    /** Toggles asset selection ability */
    setCanSelectAsset: (canSelect: boolean) => void
    /** Updates the amount */
    setAmount: (amount?: Decimal) => void
    /** Updates the note */
    setNote: (note?: string) => void
    /** Updates the destination address */
    setDestination: (address?: string) => void
    /** Resets the entire store to initial state */
    reset: () => void
}

/**
 * A hook for accessing and managing the state of the funds transfer flow.
 *
 * @returns State and setter methods for the transfer process
 *
 * @example
 * const { amount, setAmount, destination, setDestination } = useSendFunds()
 */
export const useSendFunds = (): UseSendFundsResult => {
    const selectedAsset = useSendFundsStore(state => state.selectedAsset)
    const canSelectAsset = useSendFundsStore(state => state.canSelectAsset)
    const amount = useSendFundsStore(state => state.amount)
    const note = useSendFundsStore(state => state.note)
    const destination = useSendFundsStore(state => state.destination)
    const setSelectedAsset = useSendFundsStore(state => state.setSelectedAsset)
    const setCanSelectAsset = useSendFundsStore(
        state => state.setCanSelectAsset,
    )
    const setAmount = useSendFundsStore(state => state.setAmount)
    const setNote = useSendFundsStore(state => state.setNote)
    const setDestination = useSendFundsStore(state => state.setDestination)
    const reset = useSendFundsStore(state => state.reset)

    return {
        selectedAsset,
        canSelectAsset,
        amount,
        note,
        destination,
        setSelectedAsset,
        setCanSelectAsset,
        setAmount,
        setNote,
        setDestination,
        reset,
    }
}
