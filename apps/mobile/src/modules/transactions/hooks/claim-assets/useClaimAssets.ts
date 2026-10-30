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
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import { registerStore, type Nullable } from '@perawallet/wallet-core-shared'

type ClaimAssetsState = {
    accountAddress: Nullable<string>
    assetRequests: AssetInboxRequest[]
    onFinished?: () => void
}

type ClaimAssetsActions = {
    setAccountAddress: (address: Nullable<string>) => void
    setAssetRequests: (assets: AssetInboxRequest[]) => void
    setOnFinished: (fn: () => void) => void
    reset: () => void
}

type ClaimAssetsStore = ClaimAssetsState & ClaimAssetsActions

const initialState: ClaimAssetsState = {
    accountAddress: null,
    assetRequests: [],
    onFinished: undefined,
}

export const useClaimAssetsStore = create<ClaimAssetsStore>()(set => ({
    ...initialState,
    setAccountAddress: address => set({ accountAddress: address }),
    setAssetRequests: assets => set({ assetRequests: assets }),
    setOnFinished: fn => set({ onFinished: fn }),
    reset: () => set(initialState),
}))

registerStore({
    name: 'claim-assets-store',
    clearStorage: () => {},
    resetState: () => useClaimAssetsStore.getState().reset(),
})

type UseClaimAssetsResult = {
    accountAddress: Nullable<string>
    assetRequests: AssetInboxRequest[]
    onFinished?: () => void
    setAccountAddress: (address: Nullable<string>) => void
    setAssetRequests: (assets: AssetInboxRequest[]) => void
    setOnFinished: (fn: () => void) => void
    reset: () => void
}

export const useClaimAssets = (): UseClaimAssetsResult => {
    const accountAddress = useClaimAssetsStore(state => state.accountAddress)
    const assetRequests = useClaimAssetsStore(state => state.assetRequests)
    const onFinished = useClaimAssetsStore(state => state.onFinished)
    const setAccountAddress = useClaimAssetsStore(
        state => state.setAccountAddress,
    )
    const setAssetRequests = useClaimAssetsStore(
        state => state.setAssetRequests,
    )
    const setOnFinished = useClaimAssetsStore(state => state.setOnFinished)
    const reset = useClaimAssetsStore(state => state.reset)

    return {
        accountAddress,
        assetRequests,
        onFinished,
        setAccountAddress,
        setAssetRequests,
        setOnFinished,
        reset,
    }
}
