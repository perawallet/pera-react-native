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
import type { Arc59SendSummaryResponse } from '@perawallet/wallet-core-asa-inbox'
import type { Decimal } from 'decimal.js'
import { registerStore } from '@perawallet/wallet-core-shared'

type SendMode = 'normal' | 'express' | 'sendArc59'

type SendFundsState = {
    selectedAssetId?: string
    canSelectAsset: boolean
    amount?: Decimal
    /**
     * Raw base-unit amount carried by an ASSET_TRANSFER deeplink. The
     * deeplink can't convert to display units up front because that needs
     * the asset's `decimals` (only known after the asset query resolves).
     * InputScreen reads this once `asset` is loaded, converts to display
     * units, populates `amount`, and clears this field.
     */
    pendingAmountBaseUnits?: string
    note?: string
    destination?: string
    onFinished?: () => void
    sendMode: SendMode
    arc59Summary?: Arc59SendSummaryResponse
    isCloseAccount: boolean
}

type SendFundsActions = {
    setSelectedAssetId: (id?: string) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setPendingAmountBaseUnits: (raw?: string) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    setOnFinished: (fn: () => void) => void
    setSendMode: (mode: SendMode) => void
    setArc59Summary: (summary?: Arc59SendSummaryResponse) => void
    setIsCloseAccount: (isClose: boolean) => void
    reset: () => void
    resetState: () => void
}

type SendFundsStore = SendFundsState & SendFundsActions

const initialState: SendFundsState = {
    selectedAssetId: undefined,
    canSelectAsset: true,
    amount: undefined,
    pendingAmountBaseUnits: undefined,
    note: undefined,
    destination: undefined,
    onFinished: undefined,
    sendMode: 'normal',
    arc59Summary: undefined,
    isCloseAccount: false,
}

export const useSendFundsStore = create<SendFundsStore>()(set => ({
    ...initialState,
    setSelectedAssetId: id => set({ selectedAssetId: id }),
    setCanSelectAsset: canSelect => set({ canSelectAsset: canSelect }),
    setAmount: amount => set({ amount }),
    setPendingAmountBaseUnits: raw => set({ pendingAmountBaseUnits: raw }),
    setNote: note => set({ note }),
    setDestination: address => set({ destination: address }),
    setOnFinished: fn => set({ onFinished: fn }),
    setSendMode: mode => set({ sendMode: mode }),
    setArc59Summary: summary => set({ arc59Summary: summary }),
    setIsCloseAccount: isClose => set({ isCloseAccount: isClose }),
    reset: () => set(initialState),
    resetState: () => set(initialState),
    clearStorage: () => {},
}))

registerStore({
    name: 'send-funds-store',
    clearStorage: () => {},
    resetState: () => useSendFundsStore.getState().resetState(),
})

// Explicit return types for decoupled access

type UseSendFundsResult = {
    selectedAssetId?: string
    canSelectAsset: boolean
    amount?: Decimal
    pendingAmountBaseUnits?: string
    note?: string
    destination?: string
    onFinished?: () => void
    sendMode: SendMode
    arc59Summary?: Arc59SendSummaryResponse
    isCloseAccount: boolean
    setSelectedAssetId: (id?: string) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setPendingAmountBaseUnits: (raw?: string) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    setOnFinished: (fn: () => void) => void
    setSendMode: (mode: SendMode) => void
    setArc59Summary: (summary?: Arc59SendSummaryResponse) => void
    setIsCloseAccount: (isClose: boolean) => void
    reset: () => void
}

export const useSendFunds = (): UseSendFundsResult => {
    const selectedAssetId = useSendFundsStore(state => state.selectedAssetId)
    const canSelectAsset = useSendFundsStore(state => state.canSelectAsset)
    const amount = useSendFundsStore(state => state.amount)
    const pendingAmountBaseUnits = useSendFundsStore(
        state => state.pendingAmountBaseUnits,
    )
    const note = useSendFundsStore(state => state.note)
    const destination = useSendFundsStore(state => state.destination)
    const onFinished = useSendFundsStore(state => state.onFinished)
    const sendMode = useSendFundsStore(state => state.sendMode)
    const arc59Summary = useSendFundsStore(state => state.arc59Summary)
    const setSelectedAssetId = useSendFundsStore(
        state => state.setSelectedAssetId,
    )
    const setCanSelectAsset = useSendFundsStore(
        state => state.setCanSelectAsset,
    )
    const setAmount = useSendFundsStore(state => state.setAmount)
    const setPendingAmountBaseUnits = useSendFundsStore(
        state => state.setPendingAmountBaseUnits,
    )
    const setNote = useSendFundsStore(state => state.setNote)
    const setDestination = useSendFundsStore(state => state.setDestination)
    const setOnFinished = useSendFundsStore(state => state.setOnFinished)
    const setSendMode = useSendFundsStore(state => state.setSendMode)
    const setArc59Summary = useSendFundsStore(state => state.setArc59Summary)
    const isCloseAccount = useSendFundsStore(state => state.isCloseAccount)
    const setIsCloseAccount = useSendFundsStore(
        state => state.setIsCloseAccount,
    )
    const reset = useSendFundsStore(state => state.reset)

    return {
        selectedAssetId,
        canSelectAsset,
        amount,
        pendingAmountBaseUnits,
        note,
        destination,
        onFinished,
        sendMode,
        arc59Summary,
        isCloseAccount,
        setSelectedAssetId,
        setCanSelectAsset,
        setAmount,
        setPendingAmountBaseUnits,
        setNote,
        setDestination,
        setOnFinished,
        setSendMode,
        setArc59Summary,
        setIsCloseAccount,
        reset,
    }
}
