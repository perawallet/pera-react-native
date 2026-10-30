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
import type { Decimal } from 'decimal.js'
import type {
    AssetRef,
    ChainId,
    FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import { registerStore } from '@perawallet/wallet-core-shared'
import type { AssetInboxQuote } from '@perawallet/wallet-core-transactions'

type SendMode = 'normal' | 'express' | 'sendAssetInbox'

type SendFundsState = {
    /** The asset sent; its chain is the chain the whole send runs on. */
    selectedAsset?: AssetRef
    /**
     * The network picked on Choose Network, or pinned by an entry point that
     * names one. The selected asset's chain wins once there is one.
     */
    chainId?: ChainId
    canSelectAsset: boolean
    amount?: Decimal
    /**
     * Raw base-unit amount carried by a TRANSFER deeplink. The
     * deeplink can't convert to display units up front because that needs
     * the asset's `decimals` (only known after the asset query resolves).
     * InputScreen reads this once `asset` is loaded, converts to display
     * units, populates `amount`, and clears this field.
     */
    pendingAmountBaseUnits?: string
    note?: string
    destination?: string
    /** Cleared whenever the destination changes, so it never carries over. */
    isRecipientAcknowledged: boolean
    onFinished?: () => void
    sendMode: SendMode
    assetInboxQuote?: AssetInboxQuote
    isCloseAccount: boolean
    /**
     * Set when a browser tab reopens a send the extension popup couldn't sign.
     * The amount screen presses Next once for the user, so the flow lands back
     * on its confirmation step.
     */
    shouldContinueToConfirm: boolean
    feePreset: FeePreset
    /** The amount is the most the balance allows, so the review re-sizes it to the chosen fee speed. */
    isMaxAmount: boolean
    /** Base units of the native asset: the max fee shown on the review, which the build must stay within. */
    confirmedMaxFee?: Decimal
}

type SendFundsActions = {
    setSelectedAsset: (asset?: AssetRef) => void
    setChainId: (chainId?: ChainId) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setPendingAmountBaseUnits: (raw?: string) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    setIsRecipientAcknowledged: (isAcknowledged: boolean) => void
    setOnFinished: (fn: () => void) => void
    setSendMode: (mode: SendMode) => void
    setAssetInboxQuote: (quote?: AssetInboxQuote) => void
    setIsCloseAccount: (isClose: boolean) => void
    setShouldContinueToConfirm: (shouldContinue: boolean) => void
    setFeePreset: (preset: FeePreset) => void
    setIsMaxAmount: (isMax: boolean) => void
    setConfirmedMaxFee: (fee?: Decimal) => void
    reset: () => void
    resetState: () => void
}

type SendFundsStore = SendFundsState & SendFundsActions

const initialState: SendFundsState = {
    selectedAsset: undefined,
    chainId: undefined,
    canSelectAsset: true,
    amount: undefined,
    pendingAmountBaseUnits: undefined,
    note: undefined,
    destination: undefined,
    isRecipientAcknowledged: false,
    onFinished: undefined,
    sendMode: 'normal',
    assetInboxQuote: undefined,
    isCloseAccount: false,
    shouldContinueToConfirm: false,
    feePreset: 'normal',
    isMaxAmount: false,
    confirmedMaxFee: undefined,
}

export const useSendFundsStore = create<SendFundsStore>()(set => ({
    ...initialState,
    setSelectedAsset: asset => set({ selectedAsset: asset }),
    setChainId: chainId => set({ chainId }),
    setCanSelectAsset: canSelect => set({ canSelectAsset: canSelect }),
    setAmount: amount => set({ amount }),
    setPendingAmountBaseUnits: raw => set({ pendingAmountBaseUnits: raw }),
    setNote: note => set({ note }),
    setDestination: address =>
        set({ destination: address, isRecipientAcknowledged: false }),
    setIsRecipientAcknowledged: isAcknowledged =>
        set({ isRecipientAcknowledged: isAcknowledged }),
    setOnFinished: fn => set({ onFinished: fn }),
    setSendMode: mode => set({ sendMode: mode }),
    setAssetInboxQuote: quote => set({ assetInboxQuote: quote }),
    setIsCloseAccount: isClose => set({ isCloseAccount: isClose }),
    setShouldContinueToConfirm: shouldContinue =>
        set({ shouldContinueToConfirm: shouldContinue }),
    setFeePreset: preset => set({ feePreset: preset }),
    setIsMaxAmount: isMax => set({ isMaxAmount: isMax }),
    setConfirmedMaxFee: fee => set({ confirmedMaxFee: fee }),
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
    selectedAsset?: AssetRef
    selectedAssetId?: string
    chainId?: ChainId
    canSelectAsset: boolean
    amount?: Decimal
    pendingAmountBaseUnits?: string
    note?: string
    destination?: string
    isRecipientAcknowledged: boolean
    onFinished?: () => void
    sendMode: SendMode
    assetInboxQuote?: AssetInboxQuote
    isCloseAccount: boolean
    shouldContinueToConfirm: boolean
    feePreset: FeePreset
    isMaxAmount: boolean
    confirmedMaxFee?: Decimal
    setSelectedAsset: (asset?: AssetRef) => void
    setChainId: (chainId?: ChainId) => void
    setCanSelectAsset: (canSelect: boolean) => void
    setAmount: (amount?: Decimal) => void
    setPendingAmountBaseUnits: (raw?: string) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
    setIsRecipientAcknowledged: (isAcknowledged: boolean) => void
    setOnFinished: (fn: () => void) => void
    setSendMode: (mode: SendMode) => void
    setAssetInboxQuote: (quote?: AssetInboxQuote) => void
    setIsCloseAccount: (isClose: boolean) => void
    setShouldContinueToConfirm: (shouldContinue: boolean) => void
    setFeePreset: (preset: FeePreset) => void
    setIsMaxAmount: (isMax: boolean) => void
    setConfirmedMaxFee: (fee?: Decimal) => void
    reset: () => void
}

export const useSendFunds = (): UseSendFundsResult => {
    const selectedAsset = useSendFundsStore(state => state.selectedAsset)
    const chainId = useSendFundsStore(state => state.chainId)
    const canSelectAsset = useSendFundsStore(state => state.canSelectAsset)
    const amount = useSendFundsStore(state => state.amount)
    const pendingAmountBaseUnits = useSendFundsStore(
        state => state.pendingAmountBaseUnits,
    )
    const note = useSendFundsStore(state => state.note)
    const destination = useSendFundsStore(state => state.destination)
    const isRecipientAcknowledged = useSendFundsStore(
        state => state.isRecipientAcknowledged,
    )
    const setIsRecipientAcknowledged = useSendFundsStore(
        state => state.setIsRecipientAcknowledged,
    )
    const onFinished = useSendFundsStore(state => state.onFinished)
    const sendMode = useSendFundsStore(state => state.sendMode)
    const assetInboxQuote = useSendFundsStore(state => state.assetInboxQuote)
    const setSelectedAsset = useSendFundsStore(state => state.setSelectedAsset)
    const setChainId = useSendFundsStore(state => state.setChainId)
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
    const setAssetInboxQuote = useSendFundsStore(
        state => state.setAssetInboxQuote,
    )
    const isCloseAccount = useSendFundsStore(state => state.isCloseAccount)
    const setIsCloseAccount = useSendFundsStore(
        state => state.setIsCloseAccount,
    )
    const shouldContinueToConfirm = useSendFundsStore(
        state => state.shouldContinueToConfirm,
    )
    const setShouldContinueToConfirm = useSendFundsStore(
        state => state.setShouldContinueToConfirm,
    )
    const feePreset = useSendFundsStore(state => state.feePreset)
    const setFeePreset = useSendFundsStore(state => state.setFeePreset)
    const isMaxAmount = useSendFundsStore(state => state.isMaxAmount)
    const setIsMaxAmount = useSendFundsStore(state => state.setIsMaxAmount)
    const confirmedMaxFee = useSendFundsStore(state => state.confirmedMaxFee)
    const setConfirmedMaxFee = useSendFundsStore(
        state => state.setConfirmedMaxFee,
    )
    const reset = useSendFundsStore(state => state.reset)

    return {
        selectedAsset,
        selectedAssetId: selectedAsset?.assetId,
        chainId,
        canSelectAsset,
        amount,
        pendingAmountBaseUnits,
        note,
        destination,
        isRecipientAcknowledged,
        onFinished,
        sendMode,
        assetInboxQuote,
        isCloseAccount,
        shouldContinueToConfirm,
        feePreset,
        isMaxAmount,
        confirmedMaxFee,
        setSelectedAsset,
        setChainId,
        setCanSelectAsset,
        setAmount,
        setPendingAmountBaseUnits,
        setNote,
        setDestination,
        setIsRecipientAcknowledged,
        setOnFinished,
        setSendMode,
        setAssetInboxQuote,
        setIsCloseAccount,
        setShouldContinueToConfirm,
        setFeePreset,
        setIsMaxAmount,
        setConfirmedMaxFee,
        reset,
    }
}
