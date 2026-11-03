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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { registerStore } from '@perawallet/wallet-core-shared'

type WidgetWipeState = {
    isWiping: boolean
}

type WidgetWipeActions = {
    beginWipe: () => void
    endWipe: () => void
    resetState: () => void
}

type WidgetWipeStore = WidgetWipeState & WidgetWipeActions

/**
 * Raised for the whole of a delete-all wipe. The accounts outlive the widget
 * clear by several steps, and a write in that window would put wallet data
 * back in the App Group, where a kill before the wipe ends leaves it.
 */
export const useWidgetWipeStore: UseBoundStore<StoreApi<WidgetWipeStore>> =
    create<WidgetWipeStore>()(set => ({
        isWiping: false,
        beginWipe: () => set({ isWiping: true }),
        endWipe: () => set({ isWiping: false }),
        resetState: () => set({ isWiping: false }),
    }))

registerStore({
    name: 'widget-wipe-store',
    clearStorage: () => {},
    resetState: () => useWidgetWipeStore.getState().resetState(),
})
