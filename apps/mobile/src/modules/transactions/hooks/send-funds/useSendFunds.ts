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
import type { Arc59SendSummaryResponse } from '@perawallet/wallet-core-asa-inbox'
import Decimal from 'decimal.js'

type SendMode = 'normal' | 'express' | 'arc59'

type SendFundsState = {
    selectedAsset?: AssetWithAccountBalance
    canSelectAsset: boolean
    amount?: Decimal
    note?: string
    destination?: string
    onFinished?: () => void
    sendMode: SendMode
    arc59Summary?: Arc59SendSummaryResponse
    isCloseAccount: boolean
}

type SendFundsActions = {
    setSelectedAsset: (asset?: AssetWithAccountBalance) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    setOnFinished: (fn: () => void) => void
    setSendMode: (mode: SendMode) => void
    setArc59Summary: (summary?: Arc59SendSummaryResponse) => void
    setIsCloseAccount: (isClose: boolean) => void
    reset: () => void
}

type SendFundsStore = SendFundsState & SendFundsActions

const initialState: SendFundsState = {
    selectedAsset: undefined,
    canSelectAsset: true,
    amount: undefined,
    note: undefined,
    destination: undefined,
    onFinished: undefined,
    sendMode: 'normal',
    arc59Summary: undefined,
    isCloseAccount: false,
}

export const useSendFundsStore = create<SendFundsStore>()(set => ({
    ...initialState,
    setSelectedAsset: asset => set({ selectedAsset: asset }),
    setCanSelectAsset: canSelect => set({ canSelectAsset: canSelect }),
    setAmount: amount => set({ amount }),
    setNote: note => set({ note }),
    setDestination: address => set({ destination: address }),
    setOnFinished: fn => set({ onFinished: fn }),
    setSendMode: mode => set({ sendMode: mode }),
    setArc59Summary: summary => set({ arc59Summary: summary }),
    setIsCloseAccount: isClose => set({ isCloseAccount: isClose }),
    reset: () => set(initialState),
}))

// Explicit return types for decoupled access

type UseSendFundsResult = {
    selectedAsset?: AssetWithAccountBalance
    canSelectAsset: boolean
    amount?: Decimal
    note?: string
    destination?: string
    onFinished?: () => void
    sendMode: SendMode
    arc59Summary?: Arc59SendSummaryResponse
    isCloseAccount: boolean
    setSelectedAsset: (asset?: AssetWithAccountBalance) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    setOnFinished: (fn: () => void) => void
    setSendMode: (mode: SendMode) => void
    setArc59Summary: (summary?: Arc59SendSummaryResponse) => void
    setIsCloseAccount: (isClose: boolean) => void
    reset: () => void
}

export const useSendFunds = (): UseSendFundsResult => {
    const selectedAsset = useSendFundsStore(state => state.selectedAsset)
    const canSelectAsset = useSendFundsStore(state => state.canSelectAsset)
    const amount = useSendFundsStore(state => state.amount)
    const note = useSendFundsStore(state => state.note)
    const destination = useSendFundsStore(state => state.destination)
    const onFinished = useSendFundsStore(state => state.onFinished)
    const sendMode = useSendFundsStore(state => state.sendMode)
    const arc59Summary = useSendFundsStore(state => state.arc59Summary)
    const setSelectedAsset = useSendFundsStore(state => state.setSelectedAsset)
    const setCanSelectAsset = useSendFundsStore(
        state => state.setCanSelectAsset,
    )
    const setAmount = useSendFundsStore(state => state.setAmount)
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
        selectedAsset,
        canSelectAsset,
        amount,
        note,
        destination,
        onFinished,
        sendMode,
        arc59Summary,
        isCloseAccount,
        setSelectedAsset,
        setCanSelectAsset,
        setAmount,
        setNote,
        setDestination,
        setOnFinished,
        setSendMode,
        setArc59Summary,
        setIsCloseAccount,
        reset,
    }
}
