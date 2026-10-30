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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { registerStore, type Nullable } from '@perawallet/wallet-core-shared'

// Not persisted: the selection lasts for the app session and a cold start
// comes back on All with every group collapsed.
type AssetListViewState = {
    /** `null` is All. */
    selectedChainId: Nullable<ChainId>
    expandedGroupIds: string[]
}

type AssetListViewActions = {
    setSelectedChainId: (chainId: Nullable<ChainId>) => void
    toggleGroupExpanded: (groupId: string) => void
}

type AssetListViewStore = AssetListViewState & AssetListViewActions

const initialState: AssetListViewState = {
    selectedChainId: null,
    expandedGroupIds: [],
}

export const useAssetListViewStore = create<AssetListViewStore>()(set => ({
    ...initialState,
    setSelectedChainId: selectedChainId => set({ selectedChainId }),
    toggleGroupExpanded: groupId =>
        set(state => ({
            expandedGroupIds: state.expandedGroupIds.includes(groupId)
                ? state.expandedGroupIds.filter(id => id !== groupId)
                : [...state.expandedGroupIds, groupId],
        })),
}))

registerStore({
    name: 'asset-list-view-store',
    clearStorage: () => {},
    resetState: () => useAssetListViewStore.setState(initialState),
})
